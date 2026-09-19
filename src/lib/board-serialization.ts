import type { Edge, Node } from "@xyflow/react";
import { boardEdges, boardNodes } from "../db/schema";
import type { Board } from "../types/board";

// Conversion between the React Flow graph the canvas edits and the rows in
// board_nodes / board_edges. Exported so apps that extend the engine (remix,
// templates, imports) serialize boards the same way the core actions do.

const DEFAULT_POSITION = { x: 0, y: 0 };

export type ThumbnailNode = { type?: string | null; data?: unknown };

function extractOutputNodeImage(data: Record<string, unknown>): string | null {
  const result = data.result as Record<string, unknown> | undefined;
  if (result) {
    if (typeof result.imageUrl === "string") return result.imageUrl;
    const urls = result.imageUrls as unknown;
    if (Array.isArray(urls) && typeof urls[0] === "string") return urls[0];
  }
  const images = data.images as Array<{ imageUrl?: string }> | undefined;
  if (
    Array.isArray(images) &&
    images.length > 0 &&
    typeof images[0]?.imageUrl === "string"
  ) {
    return images[0].imageUrl;
  }
  return null;
}

// Prefer the actual generated output (`outputNode`) over a user-uploaded
// `imageNode`. A board's most representative image is what it produces, not
// what was fed in. Falls back to the first imageNode upload if no output
// node has rendered an image yet.
export function pickBoardThumbnail(nodes: ThumbnailNode[]): string | null {
  let imageNodeFallback: string | null = null;
  for (const node of nodes) {
    const data = (node.data ?? {}) as Record<string, unknown>;
    if (node.type === "outputNode") {
      const url = extractOutputNodeImage(data);
      if (url) return url;
    } else if (
      node.type === "imageNode" &&
      typeof data.imageUrl === "string" &&
      !imageNodeFallback
    ) {
      imageNodeFallback = data.imageUrl;
    }
  }
  return imageNodeFallback;
}

type JsonInput = typeof boardNodes.$inferInsert.data;

const toJsonValue = (value: unknown, fallback?: unknown): JsonInput => {
  const target = value ?? fallback;
  if (target === undefined || target === null) {
    return null as unknown as JsonInput;
  }
  return JSON.parse(JSON.stringify(target)) as JsonInput;
};

type NodeInsert = typeof boardNodes.$inferInsert;
type EdgeInsert = typeof boardEdges.$inferInsert;

export const serializeNode = (boardId: string, node: Node): NodeInsert => ({
  id: String(node.id),
  boardId,
  type: node.type ?? "default",
  position: toJsonValue(node.position, DEFAULT_POSITION) as NodeInsert["position"],
  data: toJsonValue(node.data, {}) as NodeInsert["data"],
});

export const serializeEdge = (boardId: string, edge: Edge): EdgeInsert => ({
  id: String(edge.id),
  boardId,
  source: String(edge.source),
  target: String(edge.target),
  sourceHandle: edge.sourceHandle ?? null,
  targetHandle: edge.targetHandle ?? null,
  type: edge.type ?? null,
  style: edge.style !== undefined ? toJsonValue(edge.style) : null,
  data: toJsonValue(edge.data, {}),
});

const parsePosition = (value: unknown): Node["position"] => {
  if (
    value &&
    typeof value === "object" &&
    "x" in value &&
    "y" in value &&
    typeof (value as Record<string, unknown>).x === "number" &&
    typeof (value as Record<string, unknown>).y === "number"
  ) {
    return value as Node["position"];
  }
  return DEFAULT_POSITION;
};

export const deserializeNode = (record: {
  id: string;
  type: string;
  position: unknown;
  data: unknown;
}): Node => ({
  id: record.id,
  type: record.type,
  position: parsePosition(record.position),
  data: (record.data ?? {}) as Node["data"],
});

export const deserializeEdge = (record: {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  type: string | null;
  style: unknown;
  data: unknown;
}): Edge => ({
  id: record.id,
  source: record.source,
  target: record.target,
  sourceHandle: record.sourceHandle ?? undefined,
  targetHandle: record.targetHandle ?? undefined,
  type: record.type ?? undefined,
  style: (record.style ?? undefined) as Edge["style"],
  data: (record.data ?? undefined) as Edge["data"],
});

export const shapeBoard = (entry: {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  storageUsed: bigint | null;
  remixedFromBoardId: string | null;
  remixCount: number;
  isTemplate: boolean;
  thumbnailUrl: string | null;
  nodes: Array<{
    id: string;
    type: string;
    position: unknown;
    data: unknown;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: string | null;
    targetHandle: string | null;
    type: string | null;
    style: unknown;
    data: unknown;
  }>;
}): Board => {
  const nodes = entry.nodes.map((node) =>
    deserializeNode({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    })
  );

  const edges = entry.edges.map((edge) =>
    deserializeEdge({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type,
      style: edge.style,
      data: edge.data,
    })
  );

  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    isPublic: entry.isPublic,
    storageUsed:
      typeof entry.storageUsed === "bigint"
        ? Number(entry.storageUsed)
        : entry.storageUsed ?? 0,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    remixedFromBoardId: entry.remixedFromBoardId,
    remixCount: entry.remixCount,
    isTemplate: entry.isTemplate,
    thumbnailUrl: entry.thumbnailUrl,
  };
};
