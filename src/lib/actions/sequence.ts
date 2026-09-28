import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { boards, media as mediaTable } from "../../db/schema";
import { adjustBoardStorage } from "../board-storage";
import type { Denial, DirectUpload, HostAdapter } from "../host/types";

export type SequenceActionResult<T> = { ok: true; value: T } | { ok: false; error: string; denial: Denial | null };

async function ownedBoard(host: HostAdapter, boardId: string): Promise<{ userId: string } | { error: string }> {
  const userId = await host.auth.getUserId();
  if (!userId) return { error: "Sign in to export a sequence." };
  const [board] = await host.db.select({ id: boards.id }).from(boards).where(and(eq(boards.id, boardId), eq(boards.userId, userId)));
  if (!board) return { error: `Board ${boardId} not found` };
  return { userId };
}

export async function createExportUpload(
  host: HostAdapter,
  input: { boardId: string; nodeId: string; size: number },
): Promise<SequenceActionResult<{ key: string; upload: DirectUpload }>> {
  const owner = await ownedBoard(host, input.boardId);
  if ("error" in owner) return { ok: false, error: owner.error, denial: null };
  if (!(Number.isInteger(input.size) && input.size > 0)) return { ok: false, error: `Invalid export size ${input.size}`, denial: null };
  const decision = await host.limits.canStore(owner.userId, input.size);
  if (!decision.ok) return { ok: false, error: decision.message, denial: decision };
  const key = `${owner.userId}/sequences/${input.boardId}/${createId()}.mp4`;
  const upload = await host.storage.createUpload({ key, contentType: "video/mp4", size: input.size });
  return { ok: true, value: { key, upload } };
}

export async function saveSequenceExport(
  host: HostAdapter,
  input: { boardId: string; nodeId: string; key: string; size: number; durationSeconds: number; width: number; height: number },
): Promise<SequenceActionResult<{ mediaId: string; url: string }>> {
  const owner = await ownedBoard(host, input.boardId);
  if ("error" in owner) return { ok: false, error: owner.error, denial: null };
  const prefix = `${owner.userId}/sequences/${input.boardId}/`;
  if (!input.key.startsWith(prefix) || input.key.includes("..")) {
    return { ok: false, error: `Export key ${input.key} is outside ${prefix}`, denial: null };
  }
  const stored = await host.storage.getAssetSize(input.key);
  if (stored === null) return { ok: false, error: "The uploaded file was not found in storage", denial: null };
  if (stored !== input.size) return { ok: false, error: `Uploaded file is ${stored} bytes; expected ${input.size}`, denial: null };

  const url = host.storage.assetUrl(input.key);
  const [row] = await host.db
    .insert(mediaTable)
    .values({
      userId: owner.userId,
      type: "VIDEO",
      url,
      blobPath: input.key,
      fileName: input.key.split("/").pop() ?? "sequence.mp4",
      fileSize: input.size,
      width: input.width,
      height: input.height,
      prompt: `Sequence export (${input.durationSeconds.toFixed(1)}s)`,
      boardId: input.boardId,
      nodeId: input.nodeId,
    })
    .returning({ id: mediaTable.id });
  await host.limits.onStorageChanged({
    userId: owner.userId,
    boardId: input.boardId,
    deltaBytes: input.size,
    source: "direct_upload",
    blobPath: input.key,
    previousBlobPath: null,
    contentType: "video/mp4",
  });
  await adjustBoardStorage(host.db, owner.userId, input.boardId, input.size);
  return { ok: true, value: { mediaId: row.id, url } };
}
