import { test } from "node:test";
import assert from "node:assert/strict";
import type { Edge, Node } from "@xyflow/react";

import {
  captionCues,
  chunkWords,
  MAX_ON_SCREEN_CHARACTERS,
  setOnScreenText,
  toSrt,
} from "../src/lib/sequence/captions.ts";
import { shotLines, syncSequenceItems } from "../src/lib/sequence/model.ts";
import type { SequenceItem, SequenceMedia } from "../src/lib/sequence/types.ts";

const voice = { model: "openai/gpt-4o-mini-tts", voiceId: "coral" };
const line = "Meet the banana phone stand today";
const audio = (text: string, seconds: number) => ({
  url: "/uploads/v.mp3",
  mediaId: "m1",
  seconds,
  model: voice.model,
  voiceId: voice.voiceId,
  text,
});
const node = (id: string, type: string, data: Record<string, unknown>): Node => ({ id, type, position: { x: 0, y: 0 }, data });
const both = { spoken: true, onScreen: true };
// 5.042s renders as 151 frames, 2.25s as 68.
const media: Record<string, SequenceMedia> = {
  v1: { kind: "video", url: "u", seconds: 5.042 },
  o1: { kind: "image", url: "u" },
};
const cut = (voiceSeconds: number, spokenText: string): SequenceItem[] => [
  {
    sourceNodeId: "v1",
    kind: "video",
    trimStart: 0,
    trimEnd: null,
    voiceover: { text: line, audio: audio(spokenText, voiceSeconds) },
    onScreenText: null,
  },
  { sourceNodeId: "o1", kind: "image", holdSeconds: 2.25, voiceover: null, onScreenText: "50% off today" },
];

test("chunkWords packs up to 3 words or 22 characters", () => {
  assert.deepEqual(chunkWords(line), ["Meet the banana", "phone stand today"]);
  assert.deepEqual(chunkWords("Unbelievably comfortable ergonomic stand"), ["Unbelievably", "comfortable ergonomic", "stand"]);
  assert.deepEqual(chunkWords("  "), []);
});

test("chunkWords keeps long words whole", () => {
  assert.deepEqual(chunkWords("Visit https://example.com/banana-stand now"), [
    "Visit",
    "https://example.com/banana-stand",
    "now",
  ]);
});

test("spoken cues split the line's audio by character position", () => {
  const spoken = captionCues(cut(3, line), media, voice, both).filter((cue) => cue.layer === "spoken");
  const split = (3 * 16) / 33;
  assert.deepEqual(spoken, [
    { start: 0, end: split, text: "Meet the banana", layer: "spoken" },
    { start: split, end: 3, text: "phone stand today", layer: "spoken" },
  ]);
});

test("cues follow rendered item offsets", () => {
  const items: SequenceItem[] = [
    { sourceNodeId: "v1", kind: "video", trimStart: 1, trimEnd: null, voiceover: null, onScreenText: null },
    { sourceNodeId: "o1", kind: "image", holdSeconds: 2.25, voiceover: null, onScreenText: "50% off today" },
  ];
  // 4.042s trimmed renders as 121 frames.
  assert.deepEqual(captionCues(items, media, voice, both), [
    { start: 121 / 30, end: 121 / 30 + 68 / 30, text: "50% off today", layer: "onScreen" },
  ]);
  const onScreen = captionCues(cut(3, line), media, voice, both).find((cue) => cue.layer === "onScreen");
  assert.deepEqual(onScreen, { start: 151 / 30, end: 151 / 30 + 68 / 30, text: "50% off today", layer: "onScreen" });
});

test("only ready lines are captioned", () => {
  const spokenOf = (items: SequenceItem[]) =>
    captionCues(items, media, voice, both).filter((cue) => cue.layer === "spoken");
  assert.deepEqual(spokenOf(cut(3, "Older text")), []);
  assert.deepEqual(spokenOf(cut(6, line)), []);
  assert.deepEqual(captionCues(cut(3, line), media, null, both).filter((cue) => cue.layer === "spoken"), []);
});

test("legacy nodes have no captions", () => {
  assert.deepEqual(captionCues(cut(3, line), media, voice, null), []);
});

test("a layer that is off contributes nothing", () => {
  const layers = (captions: { spoken: boolean; onScreen: boolean }) =>
    captionCues(cut(3, line), media, voice, captions).map((cue) => cue.layer);
  assert.deepEqual(layers({ spoken: false, onScreen: true }), ["onScreen"]);
  assert.deepEqual(layers({ spoken: true, onScreen: false }), ["spoken", "spoken"]);
});

test("toSrt numbers spoken cues only", () => {
  assert.equal(
    toSrt(captionCues(cut(3, line), media, voice, both)),
    "1\n00:00:00,000 --> 00:00:01,455\nMeet the banana\n\n2\n00:00:01,455 --> 00:00:03,000\nphone stand today\n",
  );
  assert.equal(toSrt([{ start: 3725.5, end: 3726, text: "Late", layer: "spoken" }]), "1\n01:02:05,500 --> 01:02:06,000\nLate\n");
  assert.equal(toSrt([]), "");
});

test("setOnScreenText trims, clears and caps", () => {
  const items = cut(3, line);
  assert.equal(setOnScreenText(items, 0, "  Buy now ")[0].onScreenText, "Buy now");
  assert.equal(setOnScreenText(items, 1, "   ")[1].onScreenText, null);
  assert.throws(() => setOnScreenText(items, 0, "x".repeat(MAX_ON_SCREEN_CHARACTERS + 1)), {
    name: "InvalidSequenceEditError",
  });
  assert.throws(() => setOnScreenText(items, 5, "Hi"), { name: "InvalidSequenceEditError" });
});

test("new items take their shot's on-screen text; legacy items read as none", () => {
  const nodes = [
    node("sh1", "shotNode", { shot: { voiceover: "Meet the stand.", onScreenText: " 50% off " } }),
    node("sh2", "shotNode", { shot: { voiceover: "", onScreenText: "" } }),
    node("va", "videoNode", {}),
    node("vb", "videoNode", {}),
  ];
  const edges: Edge[] = [
    { id: "e1", source: "sh1", target: "va", targetHandle: "input" },
    { id: "e2", source: "sh2", target: "vb", targetHandle: "input" },
  ];
  const lines = shotLines(nodes, edges);
  assert.deepEqual(lines, { va: { voiceover: "Meet the stand.", onScreenText: "50% off" } });
  const synced = syncSequenceItems([], [nodes[2], nodes[3]], lines);
  assert.deepEqual(synced.map((item) => item.onScreenText), ["50% off", null]);
  const legacy = [{ sourceNodeId: "va", kind: "video", trimStart: 0, trimEnd: null, voiceover: null }] as unknown as SequenceItem[];
  assert.equal(syncSequenceItems(legacy, [nodes[2]], lines)[0].onScreenText, null);
});

// Final-review fixes.
import { activeCues } from "../src/lib/sequence/captions.ts";

test("the preview shows only the current item's cues, even past a trimmed clip's end", () => {
  const cues = captionCues(cut(3, line), media, voice, both);
  const clipEnd = 151 / 30;
  assert.deepEqual(activeCues(cues, 1, 0, clipEnd).map((cue) => cue.text), ["Meet the banana"]);
  // The clip plays ~0.2s past its end before the player advances.
  assert.deepEqual(activeCues(cues, clipEnd + 0.2, 0, clipEnd), []);
  assert.deepEqual(activeCues(cues, clipEnd + 0.2, clipEnd, clipEnd + 68 / 30).map((cue) => cue.text), ["50% off today"]);
});
