import { and, asc, eq } from "drizzle-orm";
import { bulkRuns, media } from "../../db/schema";
import type { HostAdapter } from "../host/types";

import type { BulkRunWithItems } from "../../types/bulk-run";

export async function getBulkRun(
  host: HostAdapter,
  id: string,
): Promise<
  | { success: true; run: BulkRunWithItems }
  | { success: false; error: string }
> {
  const userId = await host.auth.getUserId();
  if (!userId) return { success: false, error: "Unauthorized" };
  const [run] = await host.db
    .select()
    .from(bulkRuns)
    .where(and(eq(bulkRuns.id, id), eq(bulkRuns.userId, userId)))
    .limit(1);
  if (!run) return { success: false, error: "Not found" };
  const items = await host.db
    .select({
      id: media.id,
      url: media.url,
      prompt: media.prompt,
      bulkStatus: media.bulkStatus,
      errorMessage: media.errorMessage,
    })
    .from(media)
    .where(eq(media.bulkRunId, id))
    .orderBy(asc(media.createdAt));
  return {
    success: true,
    run: {
      id: run.id,
      boardId: run.boardId,
      status: run.status,
      total: run.total,
      completed: run.completed,
      failed: run.failed,
      cancelled: run.cancelled,
      model: run.model,
      templatePrompt: run.templatePrompt,
      createdAt: run.createdAt.toISOString(),
      items: items.map((it) => ({
        id: it.id,
        url: it.url || null,
        prompt: it.prompt ?? "",
        bulkStatus: it.bulkStatus ?? "pending",
        errorMessage: it.errorMessage,
      })),
    },
  };
}
