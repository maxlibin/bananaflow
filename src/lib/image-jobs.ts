import { and, eq, inArray, lt } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  imageJobs,
  type ImageJob,
  type MediaSourceValue,
} from "../db/schema";
import {
  IMAGE_MODELS,
  downloadGeneratedImages,
  extractGeneratedImageUrls,
  extractGenerationStatus,
  getProviderMessage,
  statusMatchesState,
  type ImageModelKey,
} from "./image-generation-service";
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
  model: ImageModelKey;
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

export async function setImageJobProviderTaskId(
  db: EngineDatabase,
  jobId: string,
  providerTaskId: string,
): Promise<void> {
  await db
    .update(imageJobs)
    .set({ providerTaskId, status: "processing" })
    .where(eq(imageJobs.id, jobId));
}

export async function markImageJobCompleted(
  db: EngineDatabase,
  jobId: string,
  result: { mediaIds: string[]; blobPaths: string[]; blobUrls: string[] },
): Promise<void> {
  await db
    .update(imageJobs)
    .set({
      status: "completed",
      resultMediaIds: result.mediaIds,
      resultBlobPaths: result.blobPaths,
      resultBlobUrls: result.blobUrls,
      completedAt: new Date(),
    })
    .where(eq(imageJobs.id, jobId));
}

export async function markImageJobFailed(
  db: EngineDatabase,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(imageJobs)
    .set({ status: "failed", errorMessage, completedAt: new Date() })
    .where(eq(imageJobs.id, jobId));
}

export async function markImageJobCancelled(
  db: EngineDatabase,
  jobId: string,
  errorMessage = "Cancelled by user",
): Promise<void> {
  await db
    .update(imageJobs)
    .set({ status: "cancelled", errorMessage, completedAt: new Date() })
    .where(eq(imageJobs.id, jobId));
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

export function mapProviderStatusToJobStatus(
  model: ImageModelKey,
  providerStatus: unknown,
): "completed" | "failed" | "processing" {
  const cfg = IMAGE_MODELS[model];
  if (statusMatchesState(providerStatus, cfg.successStates)) return "completed";
  if (statusMatchesState(providerStatus, cfg.failStates)) return "failed";
  return "processing";
}

export async function failImageJob(
  host: HostAdapter,
  job: Pick<ImageJob, "id" | "userId" | "reservedMicro">,
  message: string,
): Promise<void> {
  await host.policy.afterGenerate({
    kind: "image",
    status: "failed",
    userId: job.userId,
    jobId: job.id,
    reservedMicro: job.reservedMicro,
    reason: message,
  });
  await markImageJobFailed(host.db, job.id, message);
}

export type FinalizeImageOutcome =
  | { status: "completed"; imageUrls: string[]; mediaIds: string[] }
  | { status: "failed"; error: string }
  | { status: "processing" };

export async function finalizeImageJobFromProviderPayload(
  host: HostAdapter,
  job: ImageJob,
  payload: Record<string, unknown>,
): Promise<FinalizeImageOutcome> {
  if (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
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

  const model = job.model as ImageModelKey;
  const cfg = IMAGE_MODELS[model];
  const providerStatus = extractGenerationStatus(payload, cfg.statusField);
  const mapped = mapProviderStatusToJobStatus(model, providerStatus);

  // Webhook payloads sometimes omit the status field; URL presence = success.
  const providerUrls = extractGeneratedImageUrls(payload, {
    imageUrlField: cfg.imageUrlField,
  });

  if (mapped === "failed") {
    const message = getProviderMessage(payload, "Image generation failed");
    await failImageJob(host, job, message);
    return { status: "failed", error: message };
  }

  if (mapped !== "completed" && providerUrls.length === 0) {
    return { status: "processing" };
  }

  if (providerUrls.length === 0) {
    const message = "Provider reported success without image URLs";
    await failImageJob(host, job, message);
    return { status: "failed", error: message };
  }

  // Download all variants, upload to R2, persist media.
  const downloaded = await downloadGeneratedImages(
    providerUrls,
    new AbortController().signal,
  );
  if (downloaded.length === 0) {
    const message = "Failed to download generated images";
    await failImageJob(host, job, message);
    return { status: "failed", error: message };
  }

  const uploaded = await Promise.all(
    downloaded.map(async (img, idx) => {
      const suffix = downloaded.length > 1 ? `-${idx + 1}` : "";
      const key = `${job.userId}/image-${createId()}${suffix}.${img.ext}`;
      const blob = await host.storage.uploadAsset({
        key,
        body: Buffer.from(img.buffer),
        contentType: img.contentType,
      });
      return {
        url: blob.url,
        pathname: blob.pathname,
        fileSize: img.buffer.byteLength,
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

  await markImageJobCompleted(host.db, job.id, {
    mediaIds: persisted.mediaIds,
    blobPaths: uploaded.map((u) => u.pathname),
    blobUrls: uploaded.map((u) => u.url),
  });

  await host.policy.afterGenerate({
    kind: "image",
    status: "completed",
    userId: job.userId,
    jobId: job.id,
    model: job.model,
    count: downloaded.length,
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
