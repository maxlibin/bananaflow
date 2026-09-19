import { and, eq } from "drizzle-orm";
import type { EngineDatabase } from "./host/types";
import { boards } from "../db/schema";

const toBigInt = (value: number) => {
  if (!Number.isFinite(value)) {
    throw new Error("Storage adjustment must be a finite number");
  }
  const safe = Math.trunc(value);
  if (safe === 0) {
    return BigInt(0);
  }
  return BigInt(safe);
};

export async function adjustBoardStorage(
  db: EngineDatabase,
  userId: string,
  boardId: string,
  delta: number
) {
  if (!userId || !boardId) {
    throw new Error("adjustBoardStorage requires userId and boardId");
  }

  if (delta === 0) {
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, userId)),
      columns: { storageUsed: true },
    });
    return board?.storageUsed ? Number(board.storageUsed) : 0;
  }

  const deltaBigInt = toBigInt(delta);

  return db.transaction(async (tx) => {
    const board = await tx.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, userId)),
      columns: { storageUsed: true },
    });

    if (!board) {
      throw new Error("Board not found or access denied");
    }

    const current = board.storageUsed ?? BigInt(0);
    const next = current + deltaBigInt;
    const clamped = next < BigInt(0) ? BigInt(0) : next;

    if (clamped === current) {
      return Number(clamped);
    }

    await tx
      .update(boards)
      .set({ storageUsed: clamped })
      .where(eq(boards.id, boardId));

    return Number(clamped);
  });
}
