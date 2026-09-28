import { and, eq, inArray, lt } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  imageJobs,
  media as mediaTable,
  type ImageJob,
  type MediaSourceValue,
} from "../db/schema";
import { materializeAssets } from "./generated-assets";
import type { GeneratedAsset, TaskStatus } from "./providers/types";
import { adjustBoardStorage } from "./board-storage";
import { persistGeneratedMedia } from "./persist-generated-media";
import type { EngineDatabase, HostAdapter } from "./host/types";

export type CreateImageJobInput = {
  id?: string;
  userId: string;
  boardId: string;
  nodeId?: string | null;
  chatMessageId?: string | null;
  source: MediaSourceValue;
  model: string;
  promptSnapshot: string;
  imagesSnapshot: Array<{ imageUrl: string; blobPath?: string }>;
  settingsSnapshot: Record<string, unknown>;
  variants: number;
  reservedMicro: bigint;
  nonce: string;
  parentMediaId?: string | null;
  previousBlobPath?: string | null;
  previousSize?: number | null;
};

export async function createImageJob(
  db: EngineDatabase,
  input: CreateImageJobInput,
): Promise<ImageJob> {
  const [row] = await db
    .insert(imageJobs)
    .values({
      ...(input.id ? { id: input.id } : {}),
      userId: input.userId,
      boardId: input.boardId,
      nodeId: input.nodeId ?? null,
      chatMessageId: input.chatMessageId ?? null,
      source: input.source,
      model: input.model,
      promptSnapshot: input.promptSnapshot,
      imagesSnapshot: input.imagesSnapshot,
      settingsSnapshot: input.settingsSnapshot,
      variants: input.variants,
      reservedMicro: input.reservedMicro,
      nonce: input.nonce,
      parentMediaId: input.parentMediaId ?? null,
      previousBlobPath: input.previousBlobPath ?? null,
      previousSize: input.previousSize ?? null,
    })
    .returning();
  return row;
}

export async function findImageJob(db: EngineDatabase, jobId: string): Promise<ImageJob | null> {
  const [row] = await db
    .select()
    .from(imageJobs)
    .where(eq(imageJobs.id, jobId))
    .limit(1);
  return row ?? null;
}

export async function findImageJobForUser(
  db: EngineDatabase,
  jobId: string,
  userId: string,
): Promise<ImageJob | null> {
  const [row] = await db
    .select()
    .from(imageJobs)
    .where(and(eq(imageJobs.id, jobId), eq(imageJobs.userId, userId)))
    .limit(1);
  return row ?? null;
}

const OPEN_STATUSES = ["pending", "processing"] as const;

// Settling a job is a compare-and-set: the webhook, the poller, the cancel
// route and the creating request can all race on one job, and only the
// caller whose update wins may refund or deliver. Without it a cancel that
// lands while a completion is uploading refunds the job and then the
// completion delivers the image anyway.
async function settleImageJob(
  db: EngineDatabase,
  jobId: string,
  values: Partial<typeof imageJobs.$inferInsert>,
): Promise<boolean> {
  const settled = await db
    .update(imageJobs)
    .set({ ...values, completedAt: new Date() })
    .where(and(eq(imageJobs.id, jobId), inArray(imageJobs.status, [...OPEN_STATUSES])))
    .returning({ id: imageJobs.id });
  return settled.length === 1;
}

// Records the provider task, and moves the job to processing only if nothing
// settled it (e.g. a cancel) while the provider call was in flight.
export async function setImageJobProviderTaskId(
  db: EngineDatabase,
  jobId: string,
  providerTaskId: string,
): Promise<void> {
  await db.update(imageJobs).set({ providerTaskId }).where(eq(imageJobs.id, jobId));
  await db
    .update(imageJobs)
    .set({ status: "processing" })
    .where(and(eq(imageJobs.id, jobId), eq(imageJobs.status, "pending")));
}

export async function markImageJobCompleted(
  db: EngineDatabase,
  jobId: string,
  result: { mediaIds: string[]; blobPaths: string[]; blobUrls: string[] },
): Promise<boolean> {
  return settleImageJob(db, jobId, {
    status: "completed",
    resultMediaIds: result.mediaIds,
    resultBlobPaths: result.blobPaths,
    resultBlobUrls: result.blobUrls,
  });
}

export async function markImageJobFailed(
  db: EngineDatabase,
  jobId: string,
  errorMessage: string,
): Promise<boolean> {
  return settleImageJob(db, jobId, { status: "failed", errorMessage });
}

export async function markImageJobCancelled(
  db: EngineDatabase,
  jobId: string,
  errorMessage: string,
): Promise<boolean> {
  return settleImageJob(db, jobId, { status: "cancelled", errorMessage });
}

export async function findStaleImageJobs(
  db: EngineDatabase,
  maxAgeSeconds: number,
): Promise<ImageJob[]> {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);
  return db
    .select()
    .from(imageJobs)
    .where(
      and(
        inArray(imageJobs.status, ["pending", "processing"]),
        lt(imageJobs.updatedAt, cutoff),
      ),
    );
}

// Fails the job and refunds its reservation, unless another caller settled
// it first.
export async function failImageJob(
  host: HostAdapter,
  job: Pick<ImageJob, "id" | "userId" | "reservedMicro">,
  message: string,
): Promise<void> {
  if (!(await markImageJobFailed(host.db, job.id, message))) return;
  await host.policy.afterGenerate({
    kind: "image",
    status: "failed",
    userId: job.userId,
    jobId: job.id,
    reservedMicro: job.reservedMicro,
    reason: message,
  });
}

// Cancels the job for its owner and refunds the reservation, unless another
// caller settled it first. Returns whether this call cancelled it.
export async function cancelImageJob(
  host: HostAdapter,
  job: Pick<ImageJob, "id" | "userId" | "reservedMicro">,
): Promise<boolean> {
  if (!(await markImageJobCancelled(host.db, job.id, "Cancelled by user"))) return false;
  await host.policy.afterGenerate({
    kind: "image",
    status: "cancelled",
    userId: job.userId,
    jobId: job.id,
    reservedMicro: job.reservedMicro,
    reason: "User cancelled",
  });
  return true;
}

export type FinalizeImageOutcome =
  | { status: "completed"; imageUrls: string[]; mediaIds: string[] }
  | { status: "failed"; error: string }
  | { status: "processing" };

function outcomeForTerminalJob(job: ImageJob): FinalizeImageOutcome {
  if (
    job.status === "completed" &&
    job.resultBlobUrls?.length &&
    job.resultMediaIds?.length
  ) {
    return {
      status: "completed",
      imageUrls: job.resultBlobUrls,
      mediaIds: job.resultMediaIds,
    };
  }
  if (job.status === "failed") {
    return { status: "failed", error: job.errorMessage ?? "Failed" };
  }
  return { status: "failed", error: "Cancelled" };
}

// Stores finished assets, persists the media rows and settles the job.
// Called directly by synchronous providers and via applyImageTaskStatus for
// asynchronous ones.
export async function completeImageJob(
  host: HostAdapter,
  job: ImageJob,
  assets: GeneratedAsset[],
): Promise<FinalizeImageOutcome> {
  let materialized;
  try {
    materialized = await materializeAssets(assets, new AbortController().signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download generated images";
    await failImageJob(host, job, message);
    return { status: "failed", error: message };
  }
  if (materialized.length === 0) {
    const message = "Provider returned no images";
    await failImageJob(host, job, message);
    return { status: "failed", error: message };
  }

  const uploaded = await Promise.all(
    materialized.map(async (img, idx) => {
      const suffix = materialized.length > 1 ? `-${idx + 1}` : "";
      const key = `${job.userId}/image-${createId()}${suffix}.${img.ext}`;
      const blob = await host.storage.uploadAsset({
        key,
        body: img.bytes,
        contentType: img.contentType,
      });
      return {
        url: blob.url,
        pathname: blob.pathname,
        fileSize: img.bytes.byteLength,
        ext: img.ext,
      };
    }),
  );

  const persisted = await persistGeneratedMedia(host.db, {
    userId: job.userId,
    boardId: job.boardId,
    nodeId: job.nodeId ?? null,
    type: "IMAGE",
    source: job.source,
    chatMessageId: job.chatMessageId ?? null,
    parentMediaId: job.parentMediaId ?? null,
    modelSnapshot: {
      kind: "image",
      model: job.model,
      prompt: job.promptSnapshot,
      images: (job.imagesSnapshot ?? []).map((i) => ({
        imageUrl: i.imageUrl,
        blobPath: i.blobPath,
      })),
      settings: job.settingsSnapshot as Record<string, unknown>,
      variants: job.variants,
    },
    prompt: job.promptSnapshot,
    results: uploaded.map((u) => ({
      url: u.url,
      blobPath: u.pathname,
      fileName: u.pathname.split("/").pop() ?? null,
      fileSize: u.fileSize,
    })),
  });

  const won = await markImageJobCompleted(host.db, job.id, {
    mediaIds: persisted.mediaIds,
    blobPaths: uploaded.map((u) => u.pathname),
    blobUrls: uploaded.map((u) => u.url),
  });
  if (!won) {
    // Cancelled, failed or completed elsewhere while this call was uploading:
    // that outcome stands, so the media saved here must not reach the user.
    if (persisted.mediaIds.length > 0) {
      await host.db.delete(mediaTable).where(inArray(mediaTable.id, persisted.mediaIds));
    }
    console.warn("Image job settled elsewhere during completion; discarded its media", {
      jobId: job.id,
      orphanedBlobPaths: uploaded.map((u) => u.pathname),
    });
    const settled = await findImageJob(host.db, job.id);
    if (!settled) throw new Error(`Image job ${job.id} disappeared while completing`);
    return outcomeForTerminalJob(settled);
  }

  await host.policy.afterGenerate({
    kind: "image",
    status: "completed",
    userId: job.userId,
    jobId: job.id,
    model: job.model,
    count: materialized.length,
  });

  const totalSize = uploaded.reduce((s, u) => s + u.fileSize, 0);
  const previousDelta =
    job.previousBlobPath && job.previousSize ? -job.previousSize : 0;
  await adjustBoardStorage(host.db, job.userId, job.boardId, previousDelta + totalSize);

  return {
    status: "completed",
    imageUrls: uploaded.map((u) => u.url),
    mediaIds: persisted.mediaIds,
  };
}

// Applies a provider status (from a webhook or a poll) to a job. Idempotent:
// a job that already reached a terminal state reports it and does nothing.
export async function applyImageTaskStatus(
  host: HostAdapter,
  job: ImageJob,
  status: TaskStatus,
): Promise<FinalizeImageOutcome> {
  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return outcomeForTerminalJob(job);
  }
  if (status.status === "processing") return { status: "processing" };
  if (status.status === "failed") {
    await failImageJob(host, job, status.message);
    return { status: "failed", error: status.message };
  }
  return completeImageJob(host, job, status.assets);
}
