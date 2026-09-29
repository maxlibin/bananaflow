import type { Edge, Node } from "@xyflow/react";
import { InvalidSequenceEditError } from "./model";
import type { SequenceItem, SequenceVoice, SequenceVoiceAudio, SequenceVoiceover } from "./types";

export const DUCK_LEVEL = 0.25;
export const DUCK_RAMP_SECONDS = 0.15;
export const MAX_LINE_CHARACTERS = 600;

export type VoiceoverStatus = "none" | "unvoiced" | "stale" | "too-long" | "ready";

export function voiceoverStatus(
  voiceover: SequenceVoiceover | null,
  voice: SequenceVoice | null,
  itemSeconds: number,
): VoiceoverStatus {
  if (!voiceover || voiceover.text.trim().length === 0) return "none";
  const { audio } = voiceover;
  if (!audio) return "unvoiced";
  if (!voice || audio.text !== voiceover.text || audio.model !== voice.model || audio.voiceId !== voice.voiceId) {
    return "stale";
  }
  if (audio.seconds > itemSeconds) return "too-long";
  return "ready";
}

export function setVoiceText(items: SequenceItem[], index: number, text: string): SequenceItem[] {
  const item = items[index];
  if (!item) throw new InvalidSequenceEditError(`No item at position ${index + 1}`);
  const trimmed = text.trim();
  if (trimmed.length > MAX_LINE_CHARACTERS) {
    throw new InvalidSequenceEditError(`Voiceover lines are at most ${MAX_LINE_CHARACTERS} characters; this one is ${trimmed.length}`);
  }
  const voiceover: SequenceVoiceover | null =
    trimmed.length === 0 ? null : { text: trimmed, audio: item.voiceover?.audio ?? null };
  return items.map((existing, position) => (position === index ? { ...item, voiceover } : existing));
}

export function setVoiceAudio(items: SequenceItem[], index: number, audio: SequenceVoiceAudio): SequenceItem[] {
  const item = items[index];
  if (!item?.voiceover) throw new InvalidSequenceEditError(`Item ${index + 1} has no voiceover line`);
  if (audio.text !== item.voiceover.text) {
    throw new InvalidSequenceEditError(`Item ${index + 1}'s audio was made from different text; voice it again`);
  }
  return items.map((existing, position) =>
    position === index ? { ...item, voiceover: { text: item.voiceover!.text, audio } } : existing,
  );
}

// Voiceover text of the Shot node feeding each video node, keyed by video id.
export function shotVoiceLines(nodes: Node[], edges: Edge[]): Record<string, string> {
  const lines: Record<string, string> = {};
  for (const edge of edges) {
    const source = nodes.find((node) => node.id === edge.source);
    if (source?.type !== "shotNode") continue;
    const line = ((source.data as { shot?: { voiceover?: string } }).shot?.voiceover ?? "").trim();
    if (line) lines[edge.target] = line;
  }
  return lines;
}

// Gain for the clip's own audio at `time` seconds into an item whose voice
// plays from voiceStart to voiceEnd: ducked under the voice, ramped at edges.
export function duckingGain(time: number, voiceStart: number, voiceEnd: number, itemSeconds: number): number {
  const rampIn = Math.max(0, voiceStart - DUCK_RAMP_SECONDS);
  const rampOut = Math.min(itemSeconds, voiceEnd + DUCK_RAMP_SECONDS);
  if (time >= voiceStart && time <= voiceEnd) return DUCK_LEVEL;
  if (time < voiceStart && time >= rampIn && voiceStart > rampIn) {
    return 1 - (1 - DUCK_LEVEL) * ((time - rampIn) / (voiceStart - rampIn));
  }
  if (time > voiceEnd && time <= rampOut && rampOut > voiceEnd) {
    return DUCK_LEVEL + (1 - DUCK_LEVEL) * ((time - voiceEnd) / (rampOut - voiceEnd));
  }
  return 1;
}

// Mixes a voice (starting at the item start) over the item's clip audio.
// Both are planar channels at `sampleRate`; the clip length is kept.
export function mixVoice(
  clip: Float32Array[],
  voice: Float32Array[],
  sampleRate: number,
  itemSeconds: number,
): Float32Array<ArrayBuffer>[] {
  const voiceEnd = (voice[0]?.length ?? 0) / sampleRate;
  return clip.map((channel, index) => {
    const spoken = voice[index] ?? voice[0];
    const mixed = new Float32Array(channel.length);
    for (let sample = 0; sample < channel.length; sample += 1) {
      const time = sample / sampleRate;
      const value = channel[sample] * duckingGain(time, 0, voiceEnd, itemSeconds) + (spoken?.[sample] ?? 0);
      mixed[sample] = Math.max(-1, Math.min(1, value));
    }
    return mixed;
  });
}

// Stores freshly voiced audio on the item it was made for (found by source,
// since items may have moved), unless its line changed while voicing; then
// the line stays "needs voicing" and the user's edit is kept.
export function attachVoiceAudio(items: SequenceItem[], sourceNodeId: string, audio: SequenceVoiceAudio): SequenceItem[] {
  const index = items.findIndex((item) => item.sourceNodeId === sourceNodeId);
  if (index < 0 || items[index].voiceover?.text !== audio.text) return items;
  return setVoiceAudio(items, index, audio);
}

export { maxSpeechSeconds } from "../speech-limits";
