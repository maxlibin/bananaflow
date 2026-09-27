import type { Edge, Node } from "@xyflow/react";
import type { ShotPlan } from "./assistant";
import { compileShotPrompt, modelFamilyFromModelId } from "./compile-shot";
import type { Shot, ShotNodeData } from "./types";

const SHOT_COLUMN_OFFSET = 450;
const VIDEO_COLUMN_OFFSET = 900;
const ROW_SPACING = 320;

export type ShotGraphInput = {
  scriptNode: Node;
  plans: ShotPlan[];
  sceneHashes: Record<string, string>;
  videoModelId: string;
  aspectRatio: string;
  nodes: Node[];
  edges: Edge[];
  createId: () => string;
};

export type ShotGraph = { nodes: Node[]; edges: Edge[] };

export function shotNodeData(shot: Shot, videoModelId: string): ShotNodeData {
  return {
    label: `Shot ${shot.order}`,
    shot,
    value: compileShotPrompt(shot, modelFamilyFromModelId(videoModelId)),
    images: [],
  };
}

function shotKey(sceneId: string, order: number) {
  return `${sceneId}#${order}`;
}

// Re-breaking a script updates matching shots (same scene + order) in place,
// so the video nodes wired to them keep their results and pick up the new
// prompt. Shots of re-broken scenes with no matching plan are removed; their
// video nodes stay on the board.
export function applyShotPlans(input: ShotGraphInput): ShotGraph {
  const scriptNodeId = input.scriptNode.id;
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
  const addedNodes: Node[] = [];
  const addedEdges: Edge[] = [];
  const firstNewRow = existingShots.length - removedIds.size;
  const origin = input.scriptNode.position;

  input.plans.forEach((plan) => {
    const sceneHash = input.sceneHashes[plan.sceneId];
    if (!sceneHash) {
      throw new Error(`Shot plan references unknown scene "${plan.sceneId}"`);
    }
    const shot: Shot = { ...plan, scriptNodeId, sceneHash };
    const data = shotNodeData(shot, input.videoModelId);
    const existing = existingByKey.get(shotKey(plan.sceneId, plan.order));
    if (existing) {
      updatedById.set(existing.id, {
        ...existing,
        data: { ...existing.data, ...data },
      });
      return;
    }

    const row = firstNewRow + addedNodes.length / 2;
    const shotId = `shot-${input.createId()}`;
    const videoId = `video-${input.createId()}`;
    addedNodes.push(
      {
        id: shotId,
        type: "shotNode",
        position: { x: origin.x + SHOT_COLUMN_OFFSET, y: origin.y + row * ROW_SPACING },
        data,
      },
      {
        id: videoId,
        type: "videoNode",
        position: { x: origin.x + VIDEO_COLUMN_OFFSET, y: origin.y + row * ROW_SPACING },
        data: {
          label: `Shot ${plan.order} video`,
          selectedModel: input.videoModelId,
          modelSettings: {
            duration: String(plan.duration),
            aspectRatio: input.aspectRatio,
          },
        },
      },
    );
    addedEdges.push(
      {
        id: `edge-${input.createId()}`,
        source: scriptNodeId,
        target: shotId,
        targetHandle: "script",
      },
      {
        id: `edge-${input.createId()}`,
        source: shotId,
        target: videoId,
        targetHandle: "input",
      },
    );
  });

  const nodes = input.nodes
    .filter((node) => !removedIds.has(node.id))
    .map((node) => updatedById.get(node.id) ?? node)
    .concat(addedNodes);
  const edges = input.edges
    .filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target))
    .concat(addedEdges);
  return { nodes, edges };
}
