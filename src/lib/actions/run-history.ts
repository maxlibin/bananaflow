import { and, desc, eq } from "drizzle-orm";
import { boards, media as mediaTable } from "../../db/schema";
import { clampVariantCount } from "../run-history-math";
import type { EngineDatabase, HostAdapter } from "../host/types";

import type {
  HistoryEntry,
  HistoryGroup,
  ModelSnapshot,
} from "../../types/run-history";

const PAGE_SIZE = 100;

async function assertBoardAccess(db: EngineDatabase, boardId: string, userId: string) {
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
    columns: { id: true, userId: true, isPublic: true },
  });
  if (!board) return null;
  if (board.userId === userId) return board;
  return null;
}

function rowToEntry(row: typeof mediaTable.$inferSelect): HistoryEntry {
  return {
    id: row.id,
    type: row.type,
    url: row.url,
    blobPath: row.blobPath,
    width: row.width,
    height: row.height,
    prompt: row.prompt,
    boardId: row.boardId,
    nodeId: row.nodeId,
    runGroupId: row.runGroupId,
    parentMediaId: row.parentMediaId,
    source: row.source,
    chatMessageId: row.chatMessageId,
    pinned: row.pinned,
    errorMessage: row.errorMessage,
    modelSnapshot: (row.modelSnapshot as ModelSnapshot | null) ?? null,
    createdAt: row.createdAt,
  };
}

export async function getBoardHistory(
  host: HostAdapter,
  boardId: string,
): Promise<
  | { success: true; groups: HistoryGroup[] }
  | { success: false; error: string }
> {
  const userId = await host.auth.getUserId();
  if (!userId) return { success: false, error: "Unauthorized" };

  const board = await assertBoardAccess(host.db, boardId, userId);
  if (!board) return { success: false, error: "Board not found" };

  const rows = await host.db
    .select()
    .from(mediaTable)
    .where(and(eq(mediaTable.boardId, boardId), eq(mediaTable.userId, userId)))
    .orderBy(desc(mediaTable.pinned), desc(mediaTable.createdAt))
    .limit(PAGE_SIZE);

  const groupsByKey = new Map<string, HistoryGroup>();
  for (const row of rows) {
    const entry = rowToEntry(row);
    const key = entry.runGroupId ?? `solo:${entry.id}`;
    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        runGroupId: entry.runGroupId,
        createdAt: entry.createdAt,
        source: entry.source,
        chatMessageId: entry.chatMessageId,
        entries: [],
      };
      groupsByKey.set(key, group);
    }
    group.entries.push(entry);
    if (entry.createdAt > group.createdAt) {
      group.createdAt = entry.createdAt;
    }
  }

  const groups = [...groupsByKey.values()].sort((a, b) => {
    const aPinned = a.entries.some((e) => e.pinned);
    const bPinned = b.entries.some((e) => e.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return { success: true, groups };
}

export async function runVariations(
  host: HostAdapter,
  parentMediaId: string,
  variants: number,
): Promise<
  | {
      success: true;
      kind: "image" | "video";
      snapshot: ModelSnapshot;
      boardId: string;
      nodeId: string | null;
      parentMediaId: string;
    }
  | { success: false; error: string }
> {
  const userId = await host.auth.getUserId();
  if (!userId) return { success: false, error: "Unauthorized" };

  const row = await host.db.query.media.findFirst({
    where: and(eq(mediaTable.id, parentMediaId), eq(mediaTable.userId, userId)),
  });
  if (!row) return { success: false, error: "Parent not found" };

  const snapshot = row.modelSnapshot as ModelSnapshot | null;
  if (!snapshot) {
    return {
      success: false,
      error:
        "This entry was created before run history was enabled and cannot be replayed.",
    };
  }

  if (!row.boardId) {
    return { success: false, error: "Parent media has no board" };
  }

  const clamped = clampVariantCount(snapshot.kind, variants);

  return {
    success: true,
    kind: snapshot.kind,
    snapshot: { ...snapshot, variants: clamped },
    boardId: row.boardId,
    nodeId: row.nodeId,
    parentMediaId: row.id,
  };
}

export async function pinMedia(
  host: HostAdapter,
  mediaId: string,
  pinned: boolean,
): Promise<
  | { success: true; pinned: boolean }
  | { success: false; error: string }
> {
  const userId = await host.auth.getUserId();
  if (!userId) return { success: false, error: "Unauthorized" };

  const [updated] = await host.db
    .update(mediaTable)
    .set({ pinned })
    .where(and(eq(mediaTable.id, mediaId), eq(mediaTable.userId, userId)))
    .returning({ id: mediaTable.id, pinned: mediaTable.pinned });

  if (!updated) return { success: false, error: "Not found" };
  return { success: true, pinned: updated.pinned };
}
