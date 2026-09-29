import { test } from "node:test";
import assert from "node:assert/strict";
import type { Edge, Node } from "@xyflow/react";

import { shotLines, syncSequenceItems, validateSequence } from "../src/lib/sequence/model.ts";
import type { SequenceItem, SequenceMedia } from "../src/lib/sequence/types.ts";
import {
  DUCK_LEVEL,
  duckingGain,
  setVoiceAudio,
  setVoiceText,
  voiceoverStatus,
} from "../src/lib/sequence/voiceover.ts";
import { mixVoice } from "../src/lib/sequence/voiceover.ts";

const voice = { model: "openai/gpt-4o-mini-tts", voiceId: "coral" };
const audio = (text: string, seconds: number) => ({
  url: "/uploads/v.mp3",
  mediaId: "m1",
  seconds,
  model: voice.model,
  voiceId: voice.voiceId,
  text,
});
const node = (id: string, type: string, data: Record<string, unknown>): Node => ({ id, type, position: { x: 0, y: 0 }, data });

test("voiceoverStatus covers every state", () => {
  assert.equal(voiceoverStatus(null, voice, 4), "none");
  assert.equal(voiceoverStatus({ text: "Hi", audio: null }, voice, 4), "unvoiced");
  assert.equal(voiceoverStatus({ text: "Hi", audio: audio("Hi", 1.2) }, voice, 4), "ready");
  assert.equal(voiceoverStatus({ text: "Hello", audio: audio("Hi", 1.2) }, voice, 4), "stale");
  assert.equal(voiceoverStatus({ text: "Hi", audio: audio("Hi", 4.8) }, voice, 4), "too-long");
});

test("blank lines are no line", () => {
  assert.equal(voiceoverStatus({ text: "   ", audio: null }, voice, 4), "none");
  const items: SequenceItem[] = [{ sourceNodeId: "v1", kind: "image", holdSeconds: 3, voiceover: null, onScreenText: null }];
  assert.deepEqual(setVoiceText(items, 0, "  ")[0].voiceover, null);
  assert.deepEqual(setVoiceText(items, 0, " Buy now ")[0].voiceover, { text: "Buy now", audio: null });
});

test("changing the voice makes every voiced line stale", () => {
  const other = { model: voice.model, voiceId: "onyx" };
  assert.equal(voiceoverStatus({ text: "Hi", audio: audio("Hi", 1) }, other, 4), "stale");
  const items: SequenceItem[] = [
    { sourceNodeId: "o1", kind: "image", holdSeconds: 3, voiceover: { text: "Hi", audio: audio("Hi", 1) }, onScreenText: null },
  ];
  const media: Record<string, SequenceMedia | null> = { o1: { kind: "image", url: "u" } };
  assert.deepEqual(validateSequence(items, media, voice), { ok: true, totalSeconds: 3 });
  assert.deepEqual(validateSequence(items, media, other), { ok: false, reason: "Item 1's voiceover needs voicing again" });
  assert.deepEqual(validateSequence(items, media, null), { ok: false, reason: "Pick a voice for the voiceover" });
});

test("a line longer than a still is too long", () => {
  const items: SequenceItem[] = [
    { sourceNodeId: "o1", kind: "image", holdSeconds: 2, voiceover: { text: "Hi", audio: audio("Hi", 2.4) }, onScreenText: null },
  ];
  assert.deepEqual(validateSequence(items, { o1: { kind: "image", url: "u" } }, voice), {
    ok: false,
    reason: "Item 1's voiceover is 2.4s but the clip is 2.0s",
  });
});

test("an unvoiced line blocks export and names the item", () => {
  const items: SequenceItem[] = [{ sourceNodeId: "o1", kind: "image", holdSeconds: 2, voiceover: { text: "Hi", audio: null }, onScreenText: null }];
  assert.deepEqual(validateSequence(items, { o1: { kind: "image", url: "u" } }, voice), {
    ok: false,
    reason: "Item 1's voiceover is not voiced yet",
  });
});

test("items saved before voiceover existed read as having no line", () => {
  const legacy = [{ sourceNodeId: "o1", kind: "image", holdSeconds: 3 }] as unknown as SequenceItem[];
  const synced = syncSequenceItems(legacy, [node("o1", "outputNode", { result: { imageUrls: ["u"] } })], {});
  assert.deepEqual(synced, [{ sourceNodeId: "o1", kind: "image", holdSeconds: 3, voiceover: null, onScreenText: null }]);
  assert.deepEqual(validateSequence(synced, { o1: { kind: "image", url: "u" } }, null), { ok: true, totalSeconds: 3 });
});

test("new items take their shot's voiceover line; existing lines are kept", () => {
  const nodes = [
    node("sh1", "shotNode", { shot: { voiceover: "Meet the stand." } }),
    node("sh2", "shotNode", { shot: { voiceover: "  " } }),
    node("va", "videoNode", {}),
    node("vb", "videoNode", {}),
  ];
  const edges: Edge[] = [
    { id: "e1", source: "sh1", target: "va", targetHandle: "input" },
    { id: "e2", source: "sh2", target: "vb", targetHandle: "input" },
  ];
  const lines = shotLines(nodes, edges);
  assert.deepEqual(lines, { va: { voiceover: "Meet the stand.", onScreenText: "" } });
  const synced = syncSequenceItems([], [nodes[2], nodes[3]], lines);
  assert.deepEqual(synced.map((item) => item.voiceover), [{ text: "Meet the stand.", audio: null }, null]);
  const edited = setVoiceText(synced, 0, "Edited line");
  assert.deepEqual(syncSequenceItems(edited, [nodes[2], nodes[3]], lines)[0].voiceover, { text: "Edited line", audio: null });
});

test("setVoiceAudio stores audio made from the current text only", () => {
  const items = setVoiceText([{ sourceNodeId: "o1", kind: "image", holdSeconds: 3, voiceover: null, onScreenText: null }], 0, "Hi");
  assert.deepEqual(setVoiceAudio(items, 0, audio("Hi", 1))[0].voiceover, { text: "Hi", audio: audio("Hi", 1) });
  assert.throws(() => setVoiceAudio(items, 0, audio("Old text", 1)), /made from different text/);
});

test("duckingGain lowers clip audio under the voice with short ramps", () => {
  assert.equal(duckingGain(0.5, 1, 3, 5), 1);
  assert.equal(duckingGain(2, 1, 3, 5), DUCK_LEVEL);
  assert.equal(duckingGain(4, 1, 3, 5), 1);
  assert.ok(Math.abs(duckingGain(0.925, 1, 3, 5) - (1 + DUCK_LEVEL) / 2) < 1e-9);
  assert.ok(Math.abs(duckingGain(3.075, 1, 3, 5) - (1 + DUCK_LEVEL) / 2) < 1e-9);
  // A line at the item start is ducked from the first sample; no ramp before 0.
  assert.equal(duckingGain(0, 0, 2, 5), DUCK_LEVEL);
});

test("mixVoice ducks the clip under the voice and clamps the sum", () => {
  const rate = 100;
  const clip = [new Float32Array(300).fill(0.8), new Float32Array(300).fill(0.8)];
  const voice = [new Float32Array(100).fill(0.9), new Float32Array(100).fill(0.9)];
  const [left] = mixVoice(clip, voice, rate, 3);
  assert.ok(Math.abs(left[50] - Math.min(1, 0.8 * DUCK_LEVEL + 0.9)) < 1e-6);
  assert.ok(Math.abs(left[250] - 0.8) < 1e-6);
  assert.equal(left.length, 300);
  const loud = mixVoice([new Float32Array(10).fill(1)], [new Float32Array(10).fill(1)], 10, 1);
  assert.ok(loud[0].every((sample) => sample <= 1));
});

// Final-review fixes.
import { attachVoiceAudio, maxSpeechSeconds } from "../src/lib/sequence/voiceover.ts";

test("a voice that fits the raw clip but not its rendered frames is too long", () => {
  // 5.042s renders as 151 frames = 5.033s; a 5.04s line would be cut off.
  const items: SequenceItem[] = [
    { sourceNodeId: "v1", kind: "video", trimStart: 0, trimEnd: null, voiceover: { text: "Hi", audio: audio("Hi", 5.04) }, onScreenText: null },
  ];
  const check = validateSequence(items, { v1: { kind: "video", url: "u", seconds: 5.042 } }, voice);
  assert.equal(check.ok, false);
});

test("voice audio attaches to the item by source, only while its text is unchanged", () => {
  const items: SequenceItem[] = [
    { sourceNodeId: "a", kind: "image", holdSeconds: 3, voiceover: { text: "One", audio: null }, onScreenText: null },
    { sourceNodeId: "b", kind: "image", holdSeconds: 3, voiceover: { text: "Two edited", audio: null }, onScreenText: null },
  ];
  const attached = attachVoiceAudio(items, "a", audio("One", 1));
  assert.deepEqual(attached[0].voiceover, { text: "One", audio: audio("One", 1) });
  // The user edited line b while it was being voiced: keep the edit, drop the audio.
  assert.equal(attachVoiceAudio(items, "b", audio("Two", 1)), items);
  // The item was removed meanwhile.
  assert.equal(attachVoiceAudio(items, "gone", audio("One", 1)), items);
});

test("speech far longer than its text is out of bounds", () => {
  assert.ok(maxSpeechSeconds(15) >= 3);
  assert.ok(maxSpeechSeconds(600) < 180);
  assert.ok(maxSpeechSeconds(600) > 600 * 0.075, "normal narration must fit");
});
