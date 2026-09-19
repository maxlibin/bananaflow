import { eq, sql } from "drizzle-orm";
import { bulkRuns, media } from "../../db/schema";
import { ProviderKeyMissingError } from "../host/errors";
import type { HostAdapter } from "../host/types";
import { runImageGenerationOnce } from "../run-image-generation-once";
import type { ModelSnapshot } from "../../types/run-history";

const BATCH_SIZE = 3;
const STUCK_PENDING_MS = 30 * 60 * 1000;

type ClaimedRow = {
  id: string;
  userId: string;
  boardId: string | null;
  nodeId: string | null;
  bulkRunId: string | null;
  modelSnapshot: ModelSnapshot;
};

type StuckRow = {
  id: string;
  userId: string;
  bulkRunId: string | null;
  modelSnapshot: ModelSnapshot;
};

export type ProcessBulkSummary = { claimed: number; reaped: number };

// Drains up to BATCH_SIZE pending bulk items per call. Safe to run from
// several workers at once: claims use FOR UPDATE SKIP LOCKED.
export async function processBulk(
  host: HostAdapter,
  signal: AbortSignal,
): Promise<ProcessBulkSummary> {
  // Reaper sweep — fail any item that's been stuck pending past the
  // STUCK_PENDING_MS threshold (suggests the previous tick lost it). The host
  // refunds the per-item rate, keyed on bulkRunId:mediaId:reaper for idempotency.
  const stuckBefore = new Date(Date.now() - STUCK_PENDING_MS);
  const stuckRows = await host.db.execute<StuckRow>(sql`
    UPDATE "media"
    SET "bulkStatus" = 'failed', "errorMessage" = 'reaped: stuck pending > 30 min'
    WHERE "bulkStatus" = 'pending' AND "createdAt" < ${stuckBefore.toISOString()}
    RETURNING "id", "userId", "bulkRunId", "modelSnapshot"
  `);
  const stuckList = (stuckRows as unknown as { rows: StuckRow[] }).rows ?? [];
  for (const r of stuckList) {
    if (!r.bulkRunId) continue;
    await host.policy.afterGenerate({
      kind: "bulk",
      status: "item_reaped",
      userId: r.userId,
      bulkRunId: r.bulkRunId,
      mediaId: r.id,
      model: r.modelSnapshot.model,
    });
    await host.db
      .update(bulkRuns)
      .set({ failed: sql`${bulkRuns.failed} + 1` })
      .where(eq(bulkRuns.id, r.bulkRunId));
  }

  const claimed = await host.db.execute<ClaimedRow>(sql`
    UPDATE "media"
    SET "bulkStatus" = 'in_progress'
    WHERE "id" IN (
      SELECT "id" FROM "media"
      WHERE "bulkStatus" = 'pending'
      ORDER BY "createdAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "userId", "boardId", "nodeId", "bulkRunId", "modelSnapshot"
  `);

  const rows: ClaimedRow[] =
    (claimed as unknown as { rows: ClaimedRow[] }).rows ??
    (Array.isArray(claimed) ? (claimed as unknown as ClaimedRow[]) : []);

  const markItemFailed = async (row: ClaimedRow, message: string) => {
    await host.db
      .update(media)
      .set({ bulkStatus: "failed", errorMessage: message })
      .where(eq(media.id, row.id));
    if (row.bulkRunId) {
      await host.policy.afterGenerate({
        kind: "bulk",
        status: "item_failed",
        userId: row.userId,
        bulkRunId: row.bulkRunId,
        mediaId: row.id,
        model: row.modelSnapshot.model,
      });
      await host.db
        .update(bulkRuns)
        .set({ failed: sql`${bulkRuns.failed} + 1` })
        .where(eq(bulkRuns.id, row.bulkRunId));
    }
  };

  await Promise.allSettled(
    rows.map(async (row) => {
      let providerSecret: string;
      try {
        providerSecret = await host.keys.resolveProviderKey(row.userId, "kie");
      } catch (error) {
        if (!(error instanceof ProviderKeyMissingError)) throw error;
        await markItemFailed(row, error.message);
        return;
      }

      try {
        const out = await runImageGenerationOnce(host, {
          userId: row.userId,
          prompt: row.modelSnapshot.prompt,
          model: row.modelSnapshot.model,
          settings: (row.modelSnapshot.settings as Record<string, unknown>) ?? {},
          imageUrls: (row.modelSnapshot.images ?? [])
            .map((i) => i.imageUrl)
            .filter((u): u is string => typeof u === "string" && u.length > 0),
          providerSecret,
          signal,
          requestId: row.id,
        });

        await host.db
          .update(media)
          .set({
            url: out.url,
            blobPath: out.blobPath,
            fileSize: out.fileSize,
            bulkStatus: "completed",
          })
          .where(eq(media.id, row.id));

        if (row.bulkRunId) {
          await host.db
            .update(bulkRuns)
            .set({ completed: sql`${bulkRuns.completed} + 1` })
            .where(eq(bulkRuns.id, row.bulkRunId));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await markItemFailed(row, message);
      }
    }),
  );

  // Recompute aggregate status for any bulk run that just got touched.
  const touched = new Set<string>();
  for (const row of rows) {
    if (row.bulkRunId) touched.add(row.bulkRunId);
  }
  for (const id of touched) {
    const [run] = await host.db
      .select()
      .from(bulkRuns)
      .where(eq(bulkRuns.id, id))
      .limit(1);
    if (!run) continue;
    if (run.completed + run.failed + run.cancelled >= run.total) {
      await host.db
        .update(bulkRuns)
        .set({ status: run.failed === run.total ? "failed" : "completed" })
        .where(eq(bulkRuns.id, id));
    } else if (run.status === "pending") {
      await host.db
        .update(bulkRuns)
        .set({ status: "in_progress" })
        .where(eq(bulkRuns.id, id));
    }
    await host.policy.afterGenerate({
      kind: "bulk",
      status: "settled",
      userId: run.userId,
      bulkRunId: id,
    });
  }

  return { claimed: rows.length, reaped: stuckList.length };
}
