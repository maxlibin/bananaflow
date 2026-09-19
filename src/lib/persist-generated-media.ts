import { createId } from "@paralleldrive/cuid2";
import type { EngineDatabase } from "./host/types";
import { media as mediaTable } from "../db/schema";
import type { MediaSource, ModelSnapshot } from "../types/run-history";

type PersistInput = {
  userId: string;
  boardId: string;
  nodeId?: string | null;
  type: "IMAGE" | "VIDEO";
  source: MediaSource;
  chatMessageId?: string | null;
  parentMediaId?: string | null;
  modelSnapshot: ModelSnapshot;
  prompt: string;
  results: Array<{
    url: string;
    blobPath: string;
    width?: number | null;
    height?: number | null;
    fileName?: string | null;
    fileSize?: number | null;
  }>;
};

export type PersistResult = {
  runGroupId: string;
  mediaIds: string[];
};

export async function persistGeneratedMedia(
  db: EngineDatabase,
  input: PersistInput,
): Promise<PersistResult> {
  const runGroupId = createId();

  if (input.results.length === 0) {
    return { runGroupId, mediaIds: [] };
  }

  const rows = input.results.map((result) => ({
    userId: input.userId,
    boardId: input.boardId,
    nodeId: input.nodeId ?? null,
    type: input.type,
    url: result.url,
    blobPath: result.blobPath,
    fileName: result.fileName ?? null,
    fileSize: result.fileSize ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
    prompt: input.prompt,
    runGroupId,
    parentMediaId: input.parentMediaId ?? null,
    source: input.source,
    chatMessageId: input.chatMessageId ?? null,
    modelSnapshot: input.modelSnapshot as unknown as Record<string, unknown>,
  }));

  const inserted = await db
    .insert(mediaTable)
    .values(rows)
    .returning({ id: mediaTable.id });

  return { runGroupId, mediaIds: inserted.map((row) => row.id) };
}
