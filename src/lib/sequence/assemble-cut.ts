import type { Edge, Node } from "@xyflow/react";
import type { ShotNodeData } from "../script/types";
import { syncSequenceItems } from "./model";
import type { SequenceAspectRatio, SequenceItem, SequenceNodeData } from "./types";

const SEQUENCE_COLUMN_OFFSET = 1800;

type ScriptSequenceData = SequenceNodeData & { scriptNodeId: string };

// Wires every shot's video node (in story order) into the script's Sequence
// node, creating it to the right of the video column on first use. Existing
// items keep their trims; missing shots are appended.
export function assembleCut(input: {
  scriptNode: Node;
  nodes: Node[];
  edges: Edge[];
  aspectRatio: SequenceAspectRatio;
  createId: () => string;
}): { nodes: Node[]; edges: Edge[] } {
  const scriptId = input.scriptNode.id;
  const shots = input.nodes
    .filter((node) => node.type === "shotNode" && (node.data as ShotNodeData).shot.scriptNodeId === scriptId)
    .sort((a, b) => (a.data as ShotNodeData).shot.order - (b.data as ShotNodeData).shot.order);
  // One take per shot: the one already in the cut, else the newest fork.
  const videos = shots
    .map((shot) => {
      const targets = new Set(input.edges.filter((edge) => edge.source === shot.id).map((edge) => edge.target));
      return input.nodes.filter((node) => node.type === "videoNode" && targets.has(node.id));
    })
    .filter((takes) => takes.length > 0);
  if (videos.length === 0) {
    throw new Error("This script has no shot videos yet; break it into shots first");
  }

  const existing = input.nodes.find(
    (node) => node.type === "sequenceNode" && (node.data as ScriptSequenceData).scriptNodeId === scriptId,
  );
  const sequence: Node =
    existing ??
    ({
      id: `sequence-${input.createId()}`,
      type: "sequenceNode",
      position: { x: input.scriptNode.position.x + SEQUENCE_COLUMN_OFFSET, y: input.scriptNode.position.y },
      data: { label: "Sequence", aspectRatio: input.aspectRatio, items: [], lastExport: null, scriptNodeId: scriptId },
    } satisfies Node);

  const wiredSources = new Set(input.edges.filter((edge) => edge.target === sequence.id).map((edge) => edge.source));
  const chosen = videos.map((takes) => takes.find((take) => wiredSources.has(take.id)) ?? takes[takes.length - 1]);
  const missing = chosen.filter((video) => !wiredSources.has(video.id));
  const addedEdges: Edge[] = missing.map((video) => ({
    id: `edge-${input.createId()}`,
    source: video.id,
    target: sequence.id,
    targetHandle: "items",
  }));
  const connected = [...input.nodes.filter((node) => wiredSources.has(node.id)), ...missing];
  const data = sequence.data as ScriptSequenceData;
  let items = syncSequenceItems(data.items, connected);
  // syncSequenceItems appends; move each new shot next to its story neighbours.
  for (const video of missing) {
    const storyIndex = chosen.indexOf(video);
    const item = items.find((candidate) => candidate.sourceNodeId === video.id) as SequenceItem;
    const rest = items.filter((candidate) => candidate !== item);
    const positionOf = (neighbour: Node) => rest.findIndex((candidate) => candidate.sourceNodeId === neighbour.id);
    const before = chosen.slice(0, storyIndex).reverse().map(positionOf).find((position) => position >= 0);
    const after = chosen.slice(storyIndex + 1).map(positionOf).find((position) => position >= 0);
    const at = before !== undefined ? before + 1 : after ?? rest.length;
    items = [...rest.slice(0, at), item, ...rest.slice(at)];
  }
  const updated: Node = { ...sequence, data: { ...data, items } };

  const nodes = existing
    ? input.nodes.map((node) => (node.id === updated.id ? updated : node))
    : [...input.nodes, updated];
  return { nodes, edges: [...input.edges, ...addedEdges] };
}
