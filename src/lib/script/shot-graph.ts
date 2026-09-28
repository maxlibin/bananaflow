import type { Edge, Node } from "@xyflow/react";
import type { ShotPlan } from "./assistant";
import {
  compileShotPrompt,
  compileStillPrompt,
  modelFamilyFromModelId,
  type ScriptDirection,
} from "./compile-shot";
import type { EntityNodeData, ScriptNodeData, Shot, ShotNodeData } from "./types";

const SHOT_COLUMN_OFFSET = 450;
const KEYFRAME_COLUMN_OFFSET = 900;
const VIDEO_COLUMN_OFFSET = 1350;
const ROW_SPACING = 420;

export type ShotGraphInput = {
  scriptNode: Node;
  plans: ShotPlan[];
  sceneHashes: Record<string, string>;
  sceneHeadings: Record<string, string>;
  keyframeModelId: string;
  videoModelId: string;
  aspectRatio: string;
  nodes: Node[];
  edges: Edge[];
  createId: () => string;
};

export type ShotGraph = { nodes: Node[]; edges: Edge[] };

export function shotNodeData(
  shot: Shot,
  videoModelId: string,
  script: ScriptDirection,
): ShotNodeData {
  return {
    label: `Shot ${shot.order}`,
    shot,
    value: compileShotPrompt(shot, modelFamilyFromModelId(videoModelId), script),
    stillPrompt: compileStillPrompt(shot, script),
    images: [],
  };
}

function shotKey(sceneId: string, order: number) {
  return `${sceneId}#${order}`;
}

function entityKey(name: string) {
  return name.trim().toLowerCase();
}

// The keyframe (image) node a shot feeds, if the shot was laid out with one.
function keyframeOf(shotId: string, nodes: Node[], edges: Edge[]): Node | undefined {
  const targets = new Set(
    edges.filter((edge) => edge.source === shotId).map((edge) => edge.target),
  );
  return nodes.find((node) => node.type === "outputNode" && targets.has(node.id));
}

// Re-breaking a script updates matching shots (same scene + order) in place,
// so the keyframe and video nodes wired to them keep their results, and
// re-syncs which entities feed each keyframe. Shots of re-broken scenes with
// no matching plan are removed; their keyframe and video nodes stay.
export function applyShotPlans(input: ShotGraphInput): ShotGraph {
  const scriptNodeId = input.scriptNode.id;
  const scriptData = input.scriptNode.data as ScriptNodeData;
  // Script nodes saved before presets have no look/lighting fields.
  const scriptDirection: ScriptDirection = {
    look: scriptData.look ?? null,
    lighting: scriptData.lighting ?? null,
  };
  const entityIdsByName = new Map(
    input.nodes
      .filter(
        (node) =>
          node.type === "entityNode" &&
          (node.data as EntityNodeData).scriptNodeId === scriptNodeId,
      )
      .map((node) => [entityKey((node.data as EntityNodeData).name), node.id]),
  );
  const entityIds = new Set(entityIdsByName.values());
  const entityIdsFor = (plan: ShotPlan) =>
    plan.entities
      .map((name) => entityIdsByName.get(entityKey(name)))
      .filter((id): id is string => Boolean(id));

  const plannedScenes = new Set(input.plans.map((plan) => plan.sceneId));
  const existingShots = input.nodes.filter(
    (node) =>
      node.type === "shotNode" &&
      (node.data as ShotNodeData).shot.scriptNodeId === scriptNodeId,
  );
  const existingByKey = new Map(
    existingShots.map((node) => {
      const shot = (node.data as ShotNodeData).shot;
      return [shotKey(shot.sceneId, shot.order), node];
    }),
  );
  const plannedKeys = new Set(
    input.plans.map((plan) => shotKey(plan.sceneId, plan.order)),
  );
  const removedIds = new Set(
    existingShots
      .filter((node) => {
        const shot = (node.data as ShotNodeData).shot;
        return (
          plannedScenes.has(shot.sceneId) &&
          !plannedKeys.has(shotKey(shot.sceneId, shot.order))
        );
      })
      .map((node) => node.id),
  );

  const updatedById = new Map<string, Node>();
  const resyncedKeyframeIds = new Set<string>();
  const addedNodes: Node[] = [];
  const addedEdges: Edge[] = [];
  const edge = (source: string, target: string, targetHandle: string): Edge => ({
    id: `edge-${input.createId()}`,
    source,
    target,
    targetHandle,
  });
  let row = existingShots.length - removedIds.size;
  const origin = input.scriptNode.position;

  input.plans.forEach((plan) => {
    const sceneHash = input.sceneHashes[plan.sceneId];
    if (!sceneHash) {
      throw new Error(`Shot plan references unknown scene "${plan.sceneId}"`);
    }
    const shot: Shot = { ...plan, scriptNodeId, sceneHash, look: null, lighting: null };
    const data = shotNodeData(shot, input.videoModelId, scriptDirection);
    const existing = existingByKey.get(shotKey(plan.sceneId, plan.order));
    if (existing) {
      updatedById.set(existing.id, {
        ...existing,
        data: { ...existing.data, ...data },
      });
      const keyframe = keyframeOf(existing.id, input.nodes, input.edges);
      if (keyframe) {
        resyncedKeyframeIds.add(keyframe.id);
        entityIdsFor(plan).forEach((entityId) =>
          addedEdges.push(edge(entityId, keyframe.id, "input")),
        );
      }
      return;
    }

    const heading = input.sceneHeadings[plan.sceneId] ?? `Shot ${plan.order}`;
    const y = origin.y + row * ROW_SPACING;
    row += 1;
    const shotId = `shot-${input.createId()}`;
    const keyframeId = `output-${input.createId()}`;
    const videoId = `video-${input.createId()}`;
    addedNodes.push(
      {
        id: shotId,
        type: "shotNode",
        position: { x: origin.x + SHOT_COLUMN_OFFSET, y },
        data,
      },
      {
        id: keyframeId,
        type: "outputNode",
        position: { x: origin.x + KEYFRAME_COLUMN_OFFSET, y },
        data: {
          label: `${heading} · keyframe ${plan.order}`,
          selectedModel: input.keyframeModelId,
          modelSettings: { aspectRatio: input.aspectRatio },
        },
      },
      {
        id: videoId,
        type: "videoNode",
        position: { x: origin.x + VIDEO_COLUMN_OFFSET, y },
        data: {
          label: `${heading} · video ${plan.order}`,
          selectedModel: input.videoModelId,
          modelSettings: {
            duration: String(plan.duration),
            aspectRatio: input.aspectRatio,
          },
        },
      },
    );
    addedEdges.push(
      edge(scriptNodeId, shotId, "script"),
      edge(shotId, keyframeId, "input"),
      ...entityIdsFor(plan).map((entityId) => edge(entityId, keyframeId, "input")),
      edge(shotId, videoId, "input"),
      edge(keyframeId, videoId, "images"),
    );
  });

  const nodes = input.nodes
    .filter((node) => !removedIds.has(node.id))
    .map((node) => updatedById.get(node.id) ?? node)
    .concat(addedNodes);
  const edges = input.edges
    .filter((item) => !removedIds.has(item.source) && !removedIds.has(item.target))
    .filter(
      (item) => !(resyncedKeyframeIds.has(item.target) && entityIds.has(item.source)),
    )
    .concat(addedEdges);
  return { nodes, edges };
}
