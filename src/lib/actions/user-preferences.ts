import { and, eq, inArray } from "drizzle-orm";

import { boards, userPreferences } from "../../db/schema";
import { MAX_OPEN_TABS, type BoardTabSummary } from "../board-tabs-constants";
import type { EngineDatabase, HostAdapter } from "../host/types";


export async function getOpenTabs(host: HostAdapter): Promise<BoardTabSummary[]> {
  const userId = await host.auth.getUserId();
  if (!userId) return [];

  const prefs = await host.db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });

  const ids = prefs?.openBoardIds ?? [];
  if (ids.length === 0) return [];

  const owned = await host.db
    .select({ id: boards.id, title: boards.title })
    .from(boards)
    .where(and(eq(boards.userId, userId), inArray(boards.id, ids)));

  const byId = new Map(owned.map((b) => [b.id, b]));
  const ordered: BoardTabSummary[] = [];
  for (const id of ids) {
    const b = byId.get(id);
    if (b) ordered.push(b);
  }

  if (ordered.length !== ids.length) {
    await persistTabs(host.db, userId, ordered.map((b) => b.id));
  }

  return ordered;
}

export async function setOpenTabs(
  host: HostAdapter,
  boardIds: string[],
): Promise<{ success: boolean }> {
  const userId = await host.auth.getUserId();
  if (!userId) return { success: false };

  const limit = await host.limits.tabLimit(userId);
  const trimmed = boardIds.slice(0, limit);

  if (trimmed.length === 0) {
    await persistTabs(host.db, userId, []);
    return { success: true };
  }

  const owned = await host.db
    .select({ id: boards.id })
    .from(boards)
    .where(and(eq(boards.userId, userId), inArray(boards.id, trimmed)));
  const ownedSet = new Set(owned.map((b) => b.id));
  const validated = trimmed.filter((id) => ownedSet.has(id));

  await persistTabs(host.db, userId, validated);
  return { success: true };
}

export async function getTabLimit(host: HostAdapter): Promise<number> {
  const userId = await host.auth.getUserId();
  if (!userId) return MAX_OPEN_TABS;
  return host.limits.tabLimit(userId);
}

export async function getBoardSummaries(host: HostAdapter): Promise<BoardTabSummary[]> {
  const userId = await host.auth.getUserId();
  if (!userId) return [];

  const rows = await host.db
    .select({ id: boards.id, title: boards.title })
    .from(boards)
    .where(and(eq(boards.userId, userId), eq(boards.isTemplate, false)));

  return rows;
}

async function persistTabs(db: EngineDatabase, userId: string, ids: string[]) {
  await db
    .insert(userPreferences)
    .values({ userId, openBoardIds: ids })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { openBoardIds: ids, updatedAt: new Date() },
    });
}
