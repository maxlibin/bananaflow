import { test } from "node:test";
import assert from "node:assert/strict";
import type { Node } from "@xyflow/react";

import {
  InvalidSequenceEditError,
  moveItem,
  setHold,
  setTrim,
  sourceMedia,
  syncSequenceItems,
  validateSequence,
} from "../src/lib/sequence/model.ts";
import type { SequenceItem } from "../src/lib/sequence/types.ts";
import { assembleCut } from "../src/lib/sequence/assemble-cut.ts";
import type { Edge } from "@xyflow/react";

const node = (id: string, type: string, data: Record<string, unknown>): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

const clip = node("v1", "videoNode", { result: { status: "completed", videoUrl: "https://cdn/a.mp4" } });
const still = node("o1", "outputNode", { result: { imageUrls: ["https://cdn/end.png"] } });
const input = node("i1", "inputNode", { images: [{ imageUrl: "https://cdn/in.png" }] });
const prompt = node("p1", "promptNode", { value: "text" });

test("sourceMedia reads the current output of each source kind", () => {
  assert.deepEqual(sourceMedia(clip), { kind: "video", url: "https://cdn/a.mp4", seconds: null });
  assert.deepEqual(sourceMedia(still), { kind: "image", url: "https://cdn/end.png" });
  assert.deepEqual(sourceMedia(input), { kind: "image", url: "https://cdn/in.png" });
  assert.equal(sourceMedia(node("v2", "videoNode", {})), null);
  assert.equal(sourceMedia(prompt), null);
});

test("syncSequenceItems appends new sources, keeps edits and drops disconnected ones", () => {
  const first = syncSequenceItems([], [clip, still, prompt]);
  assert.deepEqual(first, [
    { sourceNodeId: "v1", kind: "video", trimStart: 0, trimEnd: null },
    { sourceNodeId: "o1", kind: "image", holdSeconds: 3 },
  ]);
  const trimmed = setTrim(first, 0, 1, 4, 6);
  const second = syncSequenceItems(trimmed, [still, input]);
  assert.deepEqual(second, [
    { sourceNodeId: "o1", kind: "image", holdSeconds: 3 },
    { sourceNodeId: "i1", kind: "image", holdSeconds: 3 },
  ]);
  const third = syncSequenceItems(trimmed, [clip, still]);
  assert.deepEqual(third[0], { sourceNodeId: "v1", kind: "video", trimStart: 1, trimEnd: 4 });
});

test("moveItem, setTrim and setHold return new lists and reject bad edits", () => {
  const items: SequenceItem[] = syncSequenceItems([], [clip, still]);
  assert.deepEqual(moveItem(items, 1, 0).map((item) => item.sourceNodeId), ["o1", "v1"]);
  assert.equal(items[0].sourceNodeId, "v1");
  assert.throws(() => setTrim(items, 0, 3, 2, 6), InvalidSequenceEditError);
  assert.throws(() => setTrim(items, 0, 0, 7, 6), InvalidSequenceEditError);
  assert.throws(() => setTrim(items, 1, 0, 1, 6), InvalidSequenceEditError);
  assert.throws(() => setHold(items, 1, 0.2), InvalidSequenceEditError);
  assert.throws(() => setHold(items, 0, 3), InvalidSequenceEditError);
  assert.throws(() => moveItem(items, 0, 5), InvalidSequenceEditError);
  assert.deepEqual(setHold(items, 1, 4.5)[1], { sourceNodeId: "o1", kind: "image", holdSeconds: 4.5 });
});

test("validateSequence totals the cut and names the item that blocks export", () => {
  const items = setTrim(syncSequenceItems([], [clip, still]), 0, 1, 4, 6);
  const media = {
    v1: { kind: "video" as const, url: "https://cdn/a.mp4", seconds: 6 },
    o1: { kind: "image" as const, url: "https://cdn/end.png" },
  };
  assert.deepEqual(validateSequence(items, media), { ok: true, totalSeconds: 6 });
  assert.deepEqual(validateSequence(items, { ...media, v1: null }), {
    ok: false,
    reason: "Item 1 has no media yet",
  });
  assert.deepEqual(
    validateSequence(items, { ...media, v1: { kind: "video", url: "https://cdn/a.mp4", seconds: 3 } }),
    { ok: false, reason: "Item 1 ends at 4s but its clip is only 3s long" },
  );
  assert.deepEqual(
    validateSequence(items, { ...media, v1: { kind: "video", url: "https://cdn/a.mp4", seconds: null } }),
    { ok: false, reason: "Item 1 is still loading its length" },
  );
  assert.deepEqual(validateSequence([], media), { ok: false, reason: "Add at least one clip or image" });
  const long = Array.from({ length: 19 }, (_, index) => ({ sourceNodeId: `s${index}`, kind: "image" as const, holdSeconds: 10 }));
  const longMedia = Object.fromEntries(long.map((item) => [item.sourceNodeId, { kind: "image" as const, url: "u" }]));
  assert.deepEqual(validateSequence(long, longMedia), { ok: false, reason: "The cut is 190s; the limit is 180s" });
});

const script = node("s1", "scriptNode", { aspectRatio: "9:16" });
const shot = (id: string, order: number) =>
  node(id, "shotNode", { shot: { scriptNodeId: "s1", order, duration: 4 }, value: "v", stillPrompt: "s", images: [] });
const video = (id: string) => node(id, "videoNode", { label: id });
const wire = (source: string, target: string, targetHandle: string): Edge => ({ id: `${source}-${target}`, source, target, targetHandle });

test("assembleCut wires each shot's video into a new sequence in story order", () => {
  const nodes = [script, shot("sh2", 2), shot("sh1", 1), video("vb"), video("va")];
  const edges = [wire("sh1", "va", "input"), wire("sh2", "vb", "input")];
  let n = 0;
  const graph = assembleCut({ scriptNode: script, nodes, edges, aspectRatio: "9:16", createId: () => `id${++n}` });
  const sequence = graph.nodes.find((candidate) => candidate.type === "sequenceNode");
  assert.ok(sequence);
  const wired = graph.edges.filter((edge) => edge.target === sequence.id).map((edge) => edge.source);
  assert.deepEqual(wired, ["va", "vb"]);
  assert.deepEqual((sequence.data as { items: SequenceItem[] }).items.map((item) => item.sourceNodeId), ["va", "vb"]);
});

test("re-running assembleCut adds missing shots and keeps existing trims", () => {
  const sequenceNode = node("seq", "sequenceNode", {
    label: "Sequence",
    aspectRatio: "9:16",
    items: [{ sourceNodeId: "va", kind: "video", trimStart: 1, trimEnd: 3 }],
    lastExport: null,
    scriptNodeId: "s1",
  });
  const nodes = [script, shot("sh1", 1), shot("sh2", 2), video("va"), video("vb"), sequenceNode];
  const edges = [wire("sh1", "va", "input"), wire("sh2", "vb", "input"), wire("va", "seq", "items")];
  const graph = assembleCut({ scriptNode: script, nodes, edges, aspectRatio: "9:16", createId: () => "new" });
  assert.equal(graph.nodes.filter((candidate) => candidate.type === "sequenceNode").length, 1);
  const items = (graph.nodes.find((candidate) => candidate.id === "seq")!.data as { items: SequenceItem[] }).items;
  assert.deepEqual(items, [
    { sourceNodeId: "va", kind: "video", trimStart: 1, trimEnd: 3 },
    { sourceNodeId: "vb", kind: "video", trimStart: 0, trimEnd: null },
  ]);
});
