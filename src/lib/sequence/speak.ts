import type { Denial } from "../host/types";
import type { SequenceVoice, SequenceVoiceAudio } from "./types";

export class SpeakError extends Error {
  constructor(message: string, readonly denial: Denial | null) {
    super(message);
    this.name = "SpeakError";
  }
}

export async function speakLine(input: {
  boardId: string;
  nodeId: string;
  voice: SequenceVoice;
  text: string;
}): Promise<SequenceVoiceAudio> {
  const response = await fetch("/api/generate-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boardId: input.boardId, nodeId: input.nodeId, model: input.voice.model, voiceId: input.voice.voiceId, text: input.text }),
  });
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
    const text = await response.text();
    throw new SpeakError(`Voicing failed (${response.status}): ${text.slice(0, 200) || "no response body"}`, null);
  }
  const body = (await response.json()) as
    | { ok: true; value: { url: string; mediaId: string; seconds: number } }
    | { ok: false; error: string; denial: Denial | null };
  if (!body.ok) throw new SpeakError(body.error, body.denial);
  return { ...body.value, model: input.voice.model, voiceId: input.voice.voiceId, text: input.text };
}
