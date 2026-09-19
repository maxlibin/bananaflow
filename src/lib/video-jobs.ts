import { and, eq, inArray, lt } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  videoJobs,
  type VideoJob,
} from "../db/schema";
import { materializeAssets } from "./generated-assets";
import type { GeneratedAsset, TaskStatus } from "./providers/types";
import { adjustBoardStorage } from "./board-storage";
import { persistGeneratedMedia } from "./persist-generated-media";
import type { EngineDatabase, HostAdapter } from "./host/types";
import type { VideoModelSettings } from "./video-models";
import type { MediaSourceValue } from "../db/schema";

export type CreateVideoJobInput = {
  id?: string;
  userId: string;
  boardId: string;
  nodeId?: string | null;
  chatMessageId?: string | null;
  source: MediaSourceValue;
  model: string;
  promptSnapshot: string;
  imagesSnapshot: Array<{ imageUrl: string; blobPath?: string }>;
  settingsSnapshot: Partial<VideoModelSettings>;
  reservedMicro: bigint;
  nonce: string;
  parentMediaId?: string | null;
  previousBlobPath?: string | null;
  previousSize?: number | null;
};

export async function createVideoJob(db: EngineDatabase, input: CreateVideoJobInput): Promise<VideoJob> {
  const [row] = await db
    .insert(videoJobs)
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
      reservedMicro: input.reservedMicro,
      nonce: input.nonce,
      parentMediaId: input.parentMediaId ?? null,
      previousBlobPath: input.previousBlobPath ?? null,
      previousSize: input.previousSize ?? null,
    })
    .returning();
  return row;
}

export async function findVideoJob(db: EngineDatabase, jobId: string): Promise<VideoJob | null> {
  const [row] = await db
    .select()
    .from(videoJobs)
    .where(eq(videoJobs.id, jobId))
    .limit(1);
  return row ?? null;
}

export async function findVideoJobForUser(
  db: EngineDatabase,
  jobId: string,
  userId: string,
): Promise<VideoJob | null> {
  const [row] = await db
    .select()
    .from(videoJobs)
    .where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function setVideoJobProviderTaskId(
  db: EngineDatabase,
  jobId: string,
  providerTaskId: string,
): Promise<void> {
  await db
    .update(videoJobs)
    .set({ providerTaskId, status: "processing" })
    .where(eq(videoJobs.id, jobId));
}

export async function markVideoJobCompleted(
  db: EngineDatabase,
  jobId: string,
  result: { mediaId: string; blobPath: string; blobUrl: string },
): Promise<void> {
  await db
    .update(videoJobs)
    .set({
      status: "completed",
      resultMediaId: result.mediaId,
      resultBlobPath: result.blobPath,
      resultBlobUrl: result.blobUrl,
      completedAt: new Date(),
    })
    .where(eq(videoJobs.id, jobId));
}

export async function markVideoJobFailed(
  db: EngineDatabase,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(videoJobs)
    .set({
      status: "failed",
      errorMessage,
      completedAt: new Date(),
    })
    .where(eq(videoJobs.id, jobId));
}

export async function markVideoJobCancelled(
  db: EngineDatabase,
  jobId: string,
  errorMessage = "Cancelled by user",
): Promise<void> {
  await db
    .update(videoJobs)
    .set({
      status: "cancelled",
      errorMessage,
      completedAt: new Date(),
    })
    .where(eq(videoJobs.id, jobId));
}

export async function findStaleVideoJobs(
  db: EngineDatabase,
  maxAgeSeconds: number,
): Promise<VideoJob[]> {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);
  return db
    .select()
    .from(videoJobs)
    .where(
      and(
        inArray(videoJobs.status, ["pending", "processing"]),
        lt(videoJobs.updatedAt, cutoff),
      ),
    );
}

export async function failVideoJob(
  host: HostAdapter,
  job: Pick<VideoJob, "id" | "userId" | "reservedMicro">,
  message: string,
): Promise<void> {
  await host.policy.afterGenerate({
    kind: "video",
    status: "failed",
    userId: job.userId,
    jobId: job.id,
    reservedMicro: job.reservedMicro,
    reason: message,
  });
  await markVideoJobFailed(host.db, job.id, message);
}

export type FinalizeOutcome =
  | { status: "completed"; videoUrl: string; mediaId: string }
  | { status: "failed"; error: string }
  | { status: "processing" };

function outcomeForTerminalJob(job: VideoJob): FinalizeOutcome {
  if (job.status === "completed" && job.resultBlobUrl && job.resultMediaId) {
    return { status: "completed", videoUrl: job.resultBlobUrl, mediaId: job.resultMediaId };
  }
  if (job.status === "failed") {
    return { status: "failed", error: job.errorMessage ?? "Failed" };
  }
  return { status: "failed", error: "Cancelled" };
}

export async function completeVideoJob(
  host: HostAdapter,
  job: VideoJob,
  assets: GeneratedAsset[],
): Promise<FinalizeOutcome> {
  let materialized;
  try {
    materialized = await materializeAssets(assets.slice(0, 1), new AbortController().signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset fetch failed";
    await failVideoJob(host, job, message);
    return { status: "failed", error: message };
  }
  const video = materialized[0];
  if (!video) {
    const message = "Provider returned no video";
    await failVideoJob(host, job, message);
    return { status: "failed", error: message };
  }

  const fileName = `video-${createId()}.${video.ext}`;
  const blobKey = `boards/${job.boardId}/${fileName}`;
  const blob = await host.storage.uploadAsset({
    key: blobKey,
    body: video.bytes,
    contentType: video.contentType,
  });

  const persisted = await persistGeneratedMedia(host.db, {
    userId: job.userId,
    boardId: job.boardId,
    nodeId: job.nodeId ?? null,
    type: "VIDEO",
    source: job.source,
    chatMessageId: job.chatMessageId ?? null,
    parentMediaId: job.parentMediaId ?? null,
    modelSnapshot: {
      kind: "video",
      model: job.model,
      prompt: job.promptSnapshot,
      images: (job.imagesSnapshot ?? []).map((img) => ({
        imageUrl: img.imageUrl,
        blobPath: img.blobPath,
      })),
      settings: job.settingsSnapshot as Record<string, unknown>,
      variants: 1,
    },
    prompt: job.promptSnapshot,
    results: [
      {
        url: blob.url,
        blobPath: blob.pathname,
        fileName,
        fileSize: video.bytes.length,
      },
    ],
  });

  const mediaId = persisted.mediaIds[0];
  await markVideoJobCompleted(host.db, job.id, {
    mediaId,
    blobPath: blob.pathname,
    blobUrl: blob.url,
  });

  await host.policy.afterGenerate({
    kind: "video",
    status: "completed",
    userId: job.userId,
    jobId: job.id,
    model: job.model,
  });

  // Storage delta: subtract previous if replacing, add the new size.
  const previousDelta =
    job.previousBlobPath && job.previousSize ? -job.previousSize : 0;
  await adjustBoardStorage(host.db, job.userId, job.boardId, previousDelta + video.bytes.length);

  return { status: "completed", videoUrl: blob.url, mediaId };
}

export async function applyVideoTaskStatus(
  host: HostAdapter,
  job: VideoJob,
  status: TaskStatus,
): Promise<FinalizeOutcome> {
  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return outcomeForTerminalJob(job);
  }
  if (status.status === "processing") return { status: "processing" };
  if (status.status === "failed") {
    await failVideoJob(host, job, status.message);
    return { status: "failed", error: status.message };
  }
  return completeVideoJob(host, job, status.assets);
}
