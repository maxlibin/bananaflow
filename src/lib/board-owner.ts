import { and, eq } from "drizzle-orm";
import { boards } from "../db/schema";
import type { EngineDatabase } from "./host/types";

export async function isBoardOwner(db: EngineDatabase, userId: string, boardId: string): Promise<boolean> {
  const [board] = await db.select({ id: boards.id }).from(boards).where(and(eq(boards.id, boardId), eq(boards.userId, userId)));
  return Boolean(board);
}
