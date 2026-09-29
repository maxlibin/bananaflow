import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db } from "../src/db/index.ts";
import { boards, media } from "../src/db/schema.ts";
import { host as localHost } from "../src/host/index.ts";
import type { HostAdapter } from "../src/lib/host/types.ts";
import type { Provider } from "../src/lib/providers/types.ts";
import { createGenerateSpeechRoute } from "../src/lib/routes/generate-speech.ts";

const USER = `speech-test-${createId()}`;
let boardId = "";
let othersBoardId = "";
let providerCalls = 0;

const host: HostAdapter = {
  ...localHost,
  auth: { async getUserId() { return USER; } },
  providers: {
    list: localHost.providers.list.map((provider): Provider => ({
      ...provider,
      async createSpeech(input) {
        providerCalls += 1;
        return provider.createSpeech(input);
      },
    })),
  },
};
const { POST } = createGenerateSpeechRoute(host);
const post = (body: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/generate-speech", { method: "POST", body: JSON.stringify(body) }));

before(async () => {
  const [mine] = await db.insert(boards).values({ title: "speech test", userId: USER }).returning();
  const [theirs] = await db.insert(boards).values({ title: "not mine", userId: `${USER}-other` }).returning();
  boardId = mine.id;
  othersBoardId = theirs.id;
});
after(async () => {
  await db.delete(media).where(eq(media.userId, USER));
  await db.delete(boards).where(eq(boards.userId, USER));
  await db.delete(boards).where(eq(boards.userId, `${USER}-other`));
});

test("speech for someone else's board is refused before any provider call", async () => {
  const response = await post({ boardId: othersBoardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "coral", text: "Hi" });
  assert.equal(response.status, 404);
  assert.equal(providerCalls, 0);
});

test("invalid input is refused with the reason", async () => {
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ boardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "coral", text: "   " }, /empty/],
    [{ boardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "coral", text: "x".repeat(601) }, /600/],
    [{ boardId, nodeId: "seq", model: "nope", voiceId: "coral", text: "Hi" }, /Unknown speech model/],
    [{ boardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "nope", text: "Hi" }, /Unknown voice/],
  ];
  for (const [body, message] of cases) {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.match(((await response.json()) as { error: string }).error, message);
  }
  assert.equal(providerCalls, 0);
});

test("a line becomes a stored, measured audio media row", { skip: process.env.OPENAI_API_KEY ? false : "no OpenAI key in .env" }, async () => {
  const response = await post({ boardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "coral", text: "Meet the stand." });
  const body = (await response.json()) as { ok: boolean; value: { url: string; mediaId: string; seconds: number } };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(body.value.seconds > 0.3 && body.value.seconds < 8);
  const [row] = await db.select().from(media).where(eq(media.id, body.value.mediaId));
  assert.equal(row.type, "AUDIO");
  assert.equal(row.prompt, "Meet the stand.");
  assert.ok(row.fileSize && row.fileSize > 1000);
});

// Final-review fixes: failures after the provider call come back as JSON
// with a failed outcome; speech far longer than its line is rejected.
import type { GenerationOutcome } from "../src/lib/host/types.ts";

function silentWav(seconds: number): Buffer {
  const rate = 8000;
  const pcm = Buffer.alloc(Math.round(seconds * rate) * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, pcm]);
}

function hostWith(overrides: { speechSeconds: number; failStorage: boolean }, outcomes: GenerationOutcome[]): HostAdapter {
  return {
    ...host,
    keys: { async resolveProviderKey() { return "test-key"; } },
    providers: {
      list: host.providers.list.map((provider): Provider => ({
        ...provider,
        async createSpeech() {
          return { bytes: silentWav(overrides.speechSeconds), contentType: "audio/wav", ext: "wav" };
        },
      })),
    },
    storage: overrides.failStorage
      ? { ...host.storage, async uploadAsset() { throw new Error("R2 is unreachable"); } }
      : host.storage,
    policy: { ...host.policy, async afterGenerate(outcome) { outcomes.push(outcome); } },
  };
}

const call = (target: HostAdapter, text: string) =>
  createGenerateSpeechRoute(target).POST(
    new NextRequest("http://localhost/api/generate-speech", {
      method: "POST",
      body: JSON.stringify({ boardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "coral", text }),
    }),
  );

test("a storage failure after voicing comes back as JSON and settles the request as failed", async () => {
  const outcomes: GenerationOutcome[] = [];
  const response = await call(hostWith({ speechSeconds: 1, failStorage: true }, outcomes), "Meet the stand.");
  assert.equal(response.status, 500);
  const body = (await response.json()) as { ok: boolean; error: string };
  assert.equal(body.ok, false);
  assert.match(body.error, /Storing the voiceover failed: R2 is unreachable/);
  assert.deepEqual(outcomes.map((outcome) => [outcome.kind, outcome.status]), [["speech", "failed"]]);
});

test("speech far longer than its line is rejected and not stored", async () => {
  const outcomes: GenerationOutcome[] = [];
  const before = await db.select().from(media).where(eq(media.boardId, boardId));
  const response = await call(hostWith({ speechSeconds: 60, failStorage: false }, outcomes), "Meet the stand.");
  assert.equal(response.status, 502);
  assert.match(((await response.json()) as { error: string }).error, /60\.0s for 15 characters/);
  const afterRows = await db.select().from(media).where(eq(media.boardId, boardId));
  assert.equal(afterRows.length, before.length);
  assert.deepEqual(outcomes.map((outcome) => outcome.status), ["failed"]);
});

test("voiceover audio stays out of the board's run history", async () => {
  const { getBoardHistory } = await import("../src/lib/actions/run-history.ts");
  await db.insert(media).values({ userId: USER, type: "AUDIO", url: "/uploads/v.mp3", prompt: "line", boardId });
  const history = await getBoardHistory(host, boardId);
  assert.equal(history.success, true);
  if (!history.success) return;
  const prompts = history.groups.flatMap((group) => group.entries).map((entry) => entry.prompt);
  const types = prompts;
  assert.ok(!types.includes("line"), JSON.stringify(history).slice(0, 300));
});
