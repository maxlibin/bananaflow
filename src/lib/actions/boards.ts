import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { boardEdges, boardNodes, boards } from "../../db/schema";
import { revalidatePath } from "next/cache";
import { denialActionResult } from "../host/denial";
import type { HostAdapter } from "../host/types";
import {
  deserializeEdge,
  deserializeNode,
  pickBoardThumbnail,
  serializeEdge,
  serializeNode,
  shapeBoard,
  type ThumbnailNode,
} from "../board-serialization";
import type { Board, CreateBoardData, UpdateBoardData } from "../../types/board";

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
