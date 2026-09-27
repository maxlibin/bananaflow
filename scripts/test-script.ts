import { test } from "node:test";
import assert from "node:assert/strict";
import type { Node } from "@xyflow/react";

import type { ShotPlan } from "../src/lib/script/assistant";
import { compileShotPrompt, compileStillPrompt } from "../src/lib/script/compile-shot";
import { extractScenes, hashScene } from "../src/lib/script/scenes";
import { applyShotPlans } from "../src/lib/script/shot-graph";
import { allocateSeconds } from "../src/lib/script/structures";
import { estimateScriptTiming } from "../src/lib/script/timing";
import type { EntityNodeData, ScriptDoc, Shot, ShotNodeData } from "../src/lib/script/types";

const doc: ScriptDoc = [
  { type: "p", children: [{ text: "Notes before any scene are ignored" }] },
  { type: "scene", sceneId: "s1", seconds: 3, children: [{ text: "Hook" }] },
  { type: "action", children: [{ text: "Close-up of a cracked phone screen" }] },
  { type: "voiceover", children: [{ text: "Your phone deserves better than this, honestly and truly, friend" }] },
  { type: "scene", sceneId: "s2", seconds: 5, children: [{ text: "Solution" }] },
  { type: "dialogue", character: "MAYA", children: [{ text: "It just works." }] },
];

test("scenes own the blocks that follow them", () => {
  const scenes = extractScenes(doc);
  assert.deepEqual(scenes.map((scene) => scene.sceneId), ["s1", "s2"]);
  assert.equal(scenes[0].lines.length, 2);
  assert.deepEqual(scenes[1].lines[0], { kind: "dialogue", text: "It just works.", character: "MAYA" });
});

test("timing flags spoken lines that overrun the planned scene length", () => {
  const timing = estimateScriptTiming(extractScenes(doc), 6);
  // 10 VO words at 2.5 words/s = 4s, over the 3s planned for the hook.
  assert.equal(timing.scenes[0].spokenSeconds, 4);
  assert.equal(timing.scenes[0].overPlanned, true);
  assert.equal(timing.totalSeconds, 9);
  assert.equal(timing.overTarget, true);
});

test("scene hash changes only when that scene's text changes", () => {
  const [hook, solution] = extractScenes(doc);
  const edited = extractScenes([
    ...doc.slice(0, 4),
    { type: "scene", sceneId: "s2", seconds: 5, children: [{ text: "Solution" }] },
    { type: "dialogue", character: "MAYA", children: [{ text: "It simply works." }] },
  ]);
  assert.equal(hashScene(edited[0]), hashScene(hook));
  assert.notEqual(hashScene(edited[1]), hashScene(solution));
});

const shot: Shot = {
  scriptNodeId: "script-1",
  sceneId: "s2",
  sceneHash: "abc",
  order: 1,
  duration: 5,
  framing: "close-up",
  cameraMove: "push-in",
  action: "Maya holds the phone up to camera",
  setting: "sunny kitchen",
  style: "",
  dialogue: [{ character: "MAYA", line: "It just works." }],
  voiceover: "",
  onScreenText: "",
  entities: [],
};

test("Veo prompt keeps dialogue inline, Sora puts it in its own block", () => {
  assert.equal(
    compileShotPrompt(shot, "veo"),
    'Close-up, slow push-in. Maya holds the phone up to camera. Setting: sunny kitchen. MAYA says: "It just works."',
  );
  assert.equal(
    compileShotPrompt(shot, "sora"),
    'Close-up, slow push-in. Maya holds the phone up to camera. Setting: sunny kitchen.\n\nDialogue:\n- MAYA: "It just works."',
  );
  assert.match(compileShotPrompt(shot, "seedance"), /^Single shot, 5s\.\n/);
});

function plan(sceneId: string, order: number, action: string, entities: string[]): ShotPlan {
  const { scriptNodeId: _scriptNodeId, sceneHash: _sceneHash, ...rest } = shot;
  return { ...rest, sceneId, order, action, entities };
}

test("re-breaking updates matching shots in place and keeps their video nodes", () => {
  let counter = 0;
  const createId = () => `id${(counter += 1)}`;
  const scriptNode: Node = { id: "script-1", type: "scriptNode", position: { x: 0, y: 0 }, data: {} };
  const first = applyShotPlans({
    scriptNode,
    plans: [plan("s1", 1, "A", []), plan("s1", 2, "B", []), plan("s2", 1, "C", [])],
    sceneHashes: { s1: "h1", s2: "h2" },
    sceneHeadings: {},
    keyframeModelId: "image-model",
    videoModelId: "veo3",
    aspectRatio: "9:16",
    nodes: [scriptNode],
    edges: [],
    createId,
  });
  assert.equal(first.nodes.filter((node) => node.type === "shotNode").length, 3);
  assert.equal(first.nodes.filter((node) => node.type === "outputNode").length, 3);
  assert.equal(first.nodes.filter((node) => node.type === "videoNode").length, 3);
  // Per shot: script→shot, shot→keyframe, shot→video, keyframe→video.
  assert.equal(first.edges.length, 12);

  const second = applyShotPlans({
    scriptNode,
    plans: [plan("s1", 1, "A edited", [])],
    sceneHashes: { s1: "h1b" },
    sceneHeadings: {},
    keyframeModelId: "image-model",
    videoModelId: "veo3",
    aspectRatio: "9:16",
    nodes: first.nodes,
    edges: first.edges,
    createId,
  });
  const shots = second.nodes.filter((node) => node.type === "shotNode");
  const actions = shots.map((node) => (node.data as ShotNodeData).shot.action).sort();
  // Scene s1 shot 2 is gone, shot 1 is updated in place, scene s2 is untouched.
  assert.deepEqual(actions, ["A edited", "C"]);
  assert.equal(second.nodes.filter((node) => node.type === "videoNode").length, 3);
  const updated = shots.find((node) => (node.data as ShotNodeData).shot.action === "A edited");
  assert.equal(updated?.id, first.nodes.find((node) => node.type === "shotNode")?.id);
  assert.equal((updated?.data as ShotNodeData).shot.sceneHash, "h1b");
});

test("structure skeleton seconds always add up to the target", () => {
  const seconds = allocateSeconds([0.15, 0.25, 0.4, 0.2], 30);
  assert.deepEqual(seconds, [5, 7, 12, 6]);
  assert.equal(seconds.reduce((total, value) => total + value, 0), 30);
});

test("still prompt describes one frame without camera motion or speech", () => {
  assert.equal(
    compileStillPrompt(shot),
    "Single cinematic still frame, close-up. Maya holds the phone up to camera. Setting: sunny kitchen.",
  );
});

test("tagged entities feed their shots' keyframes and re-sync on re-break", () => {
  let counter = 0;
  const createId = () => `id${(counter += 1)}`;
  const scriptNode: Node = { id: "script-1", type: "scriptNode", position: { x: 0, y: 0 }, data: {} };
  const entity = (id: string, name: string): Node => ({
    id,
    type: "entityNode",
    position: { x: -400, y: 0 },
    data: {
      label: name,
      kind: "character",
      name,
      look: "",
      value: "",
      images: [],
      scriptNodeId: "script-1",
      lastSheetUrl: null,
    } satisfies EntityNodeData,
  });
  const nodes = [scriptNode, entity("maya", "Maya"), entity("brewly", "Brewly")];
  const entityEdges = (graph: { nodes: Node[]; edges: { source: string; target: string }[] }) =>
    graph.edges
      .filter((edge) => edge.source === "maya" || edge.source === "brewly")
      .map((edge) => edge.source)
      .sort();

  const first = applyShotPlans({
    scriptNode,
    plans: [plan("s1", 1, "A", ["maya", "BREWLY", "Ghost"])],
    sceneHashes: { s1: "h1" },
    sceneHeadings: {},
    keyframeModelId: "image-model",
    videoModelId: "veo3",
    aspectRatio: "9:16",
    nodes,
    edges: [],
    createId,
  });
  // Names match case-insensitively; unknown names are ignored.
  assert.deepEqual(entityEdges(first), ["brewly", "maya"]);
  const keyframe = first.nodes.find((node) => node.type === "outputNode");
  assert.ok(first.edges.every((edge) => edge.source !== "maya" || edge.target === keyframe?.id));

  const second = applyShotPlans({
    scriptNode,
    plans: [plan("s1", 1, "A again", ["Maya"])],
    sceneHashes: { s1: "h1b" },
    sceneHeadings: {},
    keyframeModelId: "image-model",
    videoModelId: "veo3",
    aspectRatio: "9:16",
    nodes: first.nodes,
    edges: first.edges,
    createId,
  });
  assert.deepEqual(entityEdges(second), ["maya"]);
  assert.equal(second.nodes.filter((node) => node.type === "outputNode").length, 1);
});
