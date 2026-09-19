import type { Edge, Node } from "@xyflow/react";
import { and, asc, desc, eq, ilike, inArray, ne, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { boardEdges, boardNodes, boards } from "../../db/schema";
import { revalidatePath } from "next/cache";
import { denialActionResult } from "../host/denial";
import type { HostAdapter } from "../host/types";
import type {
  Board,
  CreateBoardData,
  PublicBoardsQuery,
  PublicBoardsResult,
  TemplateListEntry,
  UpdateBoardData,
} from "../../types/board";

const DEFAULT_POSITION = { x: 0, y: 0 };

type ThumbnailNode = { type?: string | null; data?: unknown };

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
function pickBoardThumbnail(nodes: ThumbnailNode[]): string | null {
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

const serializeNode = (boardId: string, node: Node): NodeInsert => ({
  id: String(node.id),
  boardId,
  type: node.type ?? "default",
  position: toJsonValue(node.position, DEFAULT_POSITION) as NodeInsert["position"],
  data: toJsonValue(node.data, {}) as NodeInsert["data"],
});

const serializeEdge = (boardId: string, edge: Edge): EdgeInsert => ({
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

const deserializeNode = (record: {
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

const deserializeEdge = (record: {
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

const shapeBoard = (entry: {
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

export async function createBoard(host: HostAdapter, data: CreateBoardData) {
  try {
    const userId = await host.auth.getUserId();

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    if (data.isPublic) {
      const publishDecision = await host.limits.canPublishBoard(userId);
      if (!publishDecision.ok) return denialActionResult(publishDecision);
    }

    const createDecision = await host.limits.canCreateBoard(userId);
    if (!createDecision.ok) return denialActionResult(createDecision);

    const [board] = await host.db
      .insert(boards)
      .values({
        title: data.title,
        description: data.description,
        isPublic: data.isPublic ?? false,
        userId,
      })
      .returning();

    await host.limits.onBoardCreated({
      userId,
      boardId: board.id,
      remixedFromBoardId: null,
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      board: {
        ...board,
        storageUsed:
          typeof board.storageUsed === "bigint"
            ? Number(board.storageUsed)
            : board.storageUsed ?? 0,
        nodeCount: 0,
        edgeCount: 0,
        nodes: [],
        edges: [],
      } satisfies Board,
    };
  } catch (error) {
    console.error("Error creating board:", error);
    return { success: false, error: "Failed to create board" };
  }
}

export async function updateBoard(host: HostAdapter, id: string, data: UpdateBoardData) {
  try {
    const userId = await host.auth.getUserId();

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const existingBoard = await host.db.query.boards.findFirst({
      where: eq(boards.id, id),
      columns: { id: true, userId: true, isPublic: true },
    });

    if (!existingBoard || existingBoard.userId !== userId) {
      return { success: false, error: "Board not found or unauthorized" };
    }

    if (data.isPublic) {
      const publishDecision = await host.limits.canPublishBoard(userId);
      if (!publishDecision.ok) return denialActionResult(publishDecision);
    }

    const nodePayload = Array.isArray(data.nodes)
      ? data.nodes.map((node) => serializeNode(id, node))
      : undefined;

    const edgePayload = Array.isArray(data.edges)
      ? data.edges.map((edge) => serializeEdge(id, edge))
      : undefined;

    const nextThumbnailUrl = Array.isArray(data.nodes)
      ? pickBoardThumbnail(data.nodes as ThumbnailNode[])
      : undefined;

    await host.db.transaction(async (tx) => {
      await tx
        .update(boards)
        .set({
          title: data.title,
          description: data.description,
          isPublic: data.isPublic,
          updatedAt: new Date(),
          ...(nextThumbnailUrl !== undefined
            ? { thumbnailUrl: nextThumbnailUrl }
            : {}),
        })
        .where(eq(boards.id, id));

      if (nodePayload) {
        await tx.delete(boardNodes).where(eq(boardNodes.boardId, id));
        if (nodePayload.length) {
          await tx.insert(boardNodes).values(nodePayload);
        }
      }

      if (edgePayload) {
        await tx.delete(boardEdges).where(eq(boardEdges.boardId, id));
        if (edgePayload.length) {
          await tx.insert(boardEdges).values(edgePayload);
        }
      }
    });

    const boardWithRelations = await host.db.query.boards.findFirst({
      where: eq(boards.id, id),
      with: {
        nodes: { orderBy: [asc(boardNodes.createdAt)] },
        edges: { orderBy: [asc(boardEdges.createdAt)] },
      },
    });

    if (!boardWithRelations) {
      return { success: false, error: "Board not found after update" };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/board/${id}`);
    revalidatePath(`/remix/${id}`);

    return { success: true, board: shapeBoard(boardWithRelations) };
  } catch (error) {
    console.error("Error updating board:", error);
    return { success: false, error: "Failed to update board" };
  }
}

export async function deleteBoard(host: HostAdapter, id: string) {
  try {
    const userId = await host.auth.getUserId();

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const existingBoard = await host.db.query.boards.findFirst({
      where: eq(boards.id, id),
      columns: { id: true, userId: true, storageUsed: true },
    });

    if (!existingBoard || existingBoard.userId !== userId) {
      return { success: false, error: "Board not found or unauthorized" };
    }

    await host.db.delete(boards).where(eq(boards.id, id));

    const storageUsedValue = existingBoard.storageUsed
      ? Number(existingBoard.storageUsed)
      : 0;

    if (storageUsedValue > 0) {
      await host.limits.onStorageChanged({
        userId,
        boardId: id,
        deltaBytes: -storageUsedValue,
        source: "board_delete",
        blobPath: null,
        previousBlobPath: null,
        contentType: null,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath(`/remix/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting board:", error);
    return { success: false, error: "Failed to delete board" };
  }
}

export async function getBoard(host: HostAdapter, id: string) {
  try {
    const userId = await host.auth.getUserId();

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const board = await host.db.query.boards.findFirst({
      where: eq(boards.id, id),
      with: {
        nodes: { orderBy: [asc(boardNodes.createdAt)] },
        edges: { orderBy: [asc(boardEdges.createdAt)] },
      },
    });

    if (!board || board.userId !== userId) {
      return { success: false, error: "Board not found or unauthorized" };
    }

    // Backfill thumbnailUrl for boards saved before the column existed.
    // Cheap because we already fetched the nodes for the editor. Don't let
    // a failed write tank the read — the dashboard backfill will retry.
    if (!board.thumbnailUrl) {
      const computed = pickBoardThumbnail(board.nodes);
      if (computed) {
        board.thumbnailUrl = computed;
        try {
          await host.db
            .update(boards)
            .set({ thumbnailUrl: computed })
            .where(eq(boards.id, id));
        } catch (error) {
          console.error("Failed to backfill thumbnailUrl on getBoard", error);
        }
      }
    }

    return { success: true, board: shapeBoard(board) };
  } catch (error) {
    console.error("Error fetching board:", error);
    return { success: false, error: "Failed to fetch board" };
  }
}

export async function getAllBoards(host: HostAdapter) {
  try {
    const userId = await host.auth.getUserId();

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const userBoards = await host.db.query.boards.findMany({
      where: and(eq(boards.userId, userId), eq(boards.isTemplate, false)),
      orderBy: [desc(boards.createdAt)],
    });

    const counts = await host.db
      .select({
        boardId: boardNodes.boardId,
        count: sql<number>`count(*)::int`,
      })
      .from(boardNodes)
      .where(
        inArray(
          boardNodes.boardId,
          userBoards.map((b) => b.id),
        ),
      )
      .groupBy(boardNodes.boardId);

    const edgeCounts = await host.db
      .select({
        boardId: boardEdges.boardId,
        count: sql<number>`count(*)::int`,
      })
      .from(boardEdges)
      .where(
        inArray(
          boardEdges.boardId,
          userBoards.map((b) => b.id),
        ),
      )
      .groupBy(boardEdges.boardId);

    const nodeCountMap = new Map(counts.map((c) => [c.boardId, c.count]));
    const edgeCountMap = new Map(edgeCounts.map((c) => [c.boardId, c.count]));

    // Lazy backfill: boards saved before thumbnailUrl existed have null. Fetch
    // their image/output nodes once, compute the thumbnail, and persist so
    // future dashboard loads don't pay this cost.
    const thumbnailMap = new Map<string, string | null>();
    const boardsMissingThumbnail = userBoards.filter((b) => !b.thumbnailUrl);

    if (boardsMissingThumbnail.length > 0) {
      const candidateNodes = await host.db
        .select({
          boardId: boardNodes.boardId,
          type: boardNodes.type,
          data: boardNodes.data,
          createdAt: boardNodes.createdAt,
        })
        .from(boardNodes)
        .where(
          and(
            inArray(
              boardNodes.boardId,
              boardsMissingThumbnail.map((b) => b.id),
            ),
            inArray(boardNodes.type, ["imageNode", "outputNode"]),
          ),
        )
        .orderBy(asc(boardNodes.createdAt));

      const nodesByBoard = new Map<string, typeof candidateNodes>();
      for (const node of candidateNodes) {
        const list = nodesByBoard.get(node.boardId) ?? [];
        list.push(node);
        nodesByBoard.set(node.boardId, list);
      }

      const updates: Array<{ id: string; thumbnailUrl: string }> = [];
      for (const board of boardsMissingThumbnail) {
        const nodes = nodesByBoard.get(board.id) ?? [];
        const computed = pickBoardThumbnail(nodes);
        if (computed) {
          thumbnailMap.set(board.id, computed);
          updates.push({ id: board.id, thumbnailUrl: computed });
        }
      }

      // Chunk writes to avoid fanning out hundreds of UPDATEs on a single
      // pool when a long-time user lands on the dashboard for the first
      // time post-deploy. After this initial pass the column is set and
      // this branch never runs again for that user.
      const CHUNK = 10;
      for (let i = 0; i < updates.length; i += CHUNK) {
        const chunk = updates.slice(i, i + CHUNK);
        try {
          await Promise.all(
            chunk.map((u) =>
              host.db
                .update(boards)
                .set({ thumbnailUrl: u.thumbnailUrl })
                .where(eq(boards.id, u.id)),
            ),
          );
        } catch (error) {
          console.error("Thumbnail backfill chunk failed", error);
        }
      }
    }

    const shapedBoards: Board[] = userBoards.map(
      ({ userId: _userId, storageUsed, ...board }) => ({
        ...board,
        thumbnailUrl: board.thumbnailUrl ?? thumbnailMap.get(board.id) ?? null,
        storageUsed:
          typeof storageUsed === "bigint"
            ? Number(storageUsed)
            : storageUsed ?? 0,
        nodeCount: nodeCountMap.get(board.id) ?? 0,
        edgeCount: edgeCountMap.get(board.id) ?? 0,
      }),
    );

    return { success: true, boards: shapedBoards };
  } catch (error) {
    console.error("Error fetching boards:", error);
    return { success: false, error: "Failed to fetch boards" };
  }
}

export interface RemixStats {
  totalBoards: number;
  totalRemixes: number;
  featuredCount: number;
}
