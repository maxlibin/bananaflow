import { createId } from "@paralleldrive/cuid2";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { NextResponse, type NextRequest } from "next/server";
import { media as mediaTable } from "../../db/schema";
import { isBoardOwner } from "../board-owner";
import { adjustBoardStorage } from "../board-storage";
import { ProviderKeyMissingError } from "../host/errors";
import type { Denial, HostAdapter } from "../host/types";
import { getProvider } from "../providers";
import { SpeechProviderError, type SpeechResult } from "../providers/types";
import { MAX_LINE_CHARACTERS } from "../sequence/voiceover";
import { maxSpeechSeconds } from "../speech-limits";

class SpeechStageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpeechStageError";
  }
}

// Runs one step after voicing and names it in the error, keeping the cause.
async function stage<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new SpeechStageError(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

type SpeechBody = { boardId: string; nodeId: string; model: string; voiceId: string; text: string };

const fail = (status: number, error: string, denial: Denial | null) =>
  NextResponse.json({ ok: false, error, denial }, { status });

function parseBody(raw: unknown): SpeechBody | string {
  const body = (raw ?? {}) as Record<string, unknown>;
  for (const field of ["boardId", "nodeId", "model", "voiceId", "text"] as const) {
    if (typeof body[field] !== "string") return `${field} is required`;
  }
  return body as SpeechBody;
}

export function createGenerateSpeechRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    const userId = await host.auth.getUserId();
    if (!userId) return fail(401, "Sign in to voice lines.", null);
    const body = parseBody(await request.json().catch(() => null));
    if (typeof body === "string") return fail(400, body, null);
    if (!(await isBoardOwner(host.db, userId, body.boardId))) return fail(404, `Board ${body.boardId} not found`, null);

    const info = host.models.speech[body.model];
    if (!info) return fail(400, `Unknown speech model "${body.model}"`, null);
    if (!info.voices.some((voice) => voice.id === body.voiceId)) {
      return fail(400, `Unknown voice "${body.voiceId}" for ${info.label}`, null);
    }
    const text = body.text.trim();
    const limit = Math.min(info.maxCharacters, MAX_LINE_CHARACTERS);
    if (text.length === 0) return fail(400, "The voiceover line is empty", null);
    if (text.length > limit) return fail(400, `Lines are at most ${limit} characters; this one is ${text.length}`, null);

    let secret: string;
    try {
      secret = await host.keys.resolveProviderKey(userId, info.provider);
    } catch (error) {
      if (error instanceof ProviderKeyMissingError) return fail(400, error.hint, null);
      throw error;
    }

    const requestId = `speech_${createId()}`;
    const decision = await host.policy.beforeGenerate({
      kind: "speech",
      userId,
      requestId,
      boardId: body.boardId,
      model: body.model,
      characters: text.length,
    });
    if (!decision.ok) return fail(decision.status, decision.message, decision);

    const settleFailed = async (status: number, message: string) => {
      await host.policy.afterGenerate({
        kind: "speech",
        status: "failed",
        userId,
        requestId,
        model: body.model,
        reservedMicro: decision.reservedMicro,
        reason: message,
      });
      return fail(status, message, null);
    };

    let speech: SpeechResult;
    try {
      speech = await getProvider(host, info.provider).createSpeech({
        model: body.model,
        providerModel: info.providerModel,
        text,
        voiceId: body.voiceId,
        secret,
      });
    } catch (error) {
      if (!(error instanceof SpeechProviderError)) throw error;
      return settleFailed(502, error.message);
    }

    // Every later failure is reported with its cause and settles the request
    // as failed (server errors would otherwise reach the client redacted).
    try {
      const seconds = await stage("Measuring the voiceover", () =>
        new Input({ source: new BufferSource(speech.bytes), formats: ALL_FORMATS }).computeDuration(),
      );
      const limit = maxSpeechSeconds(text.length);
      if (seconds > limit) {
        return settleFailed(
          502,
          `The voice ran ${seconds.toFixed(1)}s for ${text.length} characters (limit ${limit.toFixed(0)}s); rewrite the line as plain narration`,
        );
      }
      const key = `${userId}/voice/${body.boardId}/${createId()}.${speech.ext}`;
      const stored = await stage("Storing the voiceover", () =>
        host.storage.uploadAsset({ key, body: speech.bytes, contentType: speech.contentType }),
      );
      const mediaId = await stage("Saving the voiceover", async () => {
        const [row] = await host.db
          .insert(mediaTable)
          .values({
            userId,
            type: "AUDIO",
            url: stored.url,
            blobPath: stored.pathname,
            fileName: key.split("/").pop() ?? `voice.${speech.ext}`,
            fileSize: speech.bytes.byteLength,
            prompt: text,
            boardId: body.boardId,
            nodeId: body.nodeId,
          })
          .returning({ id: mediaTable.id });
        await adjustBoardStorage(host.db, userId, body.boardId, speech.bytes.byteLength);
        await host.limits.onStorageChanged({
          userId,
          boardId: body.boardId,
          deltaBytes: speech.bytes.byteLength,
          source: "speech",
          blobPath: stored.pathname,
          previousBlobPath: null,
          contentType: speech.contentType,
        });
        return row.id;
      });
      await host.policy.afterGenerate({
        kind: "speech",
        status: "completed",
        userId,
        requestId,
        model: body.model,
        characters: text.length,
        boardId: body.boardId,
        mediaId,
      });
      return NextResponse.json({ ok: true, value: { url: stored.url, mediaId, seconds } });
    } catch (error) {
      if (!(error instanceof SpeechStageError)) throw error;
      return settleFailed(500, error.message);
    }
  }

  return { POST };
}
