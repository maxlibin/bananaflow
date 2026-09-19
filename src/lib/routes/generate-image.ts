import { NextResponse, type NextRequest } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { denialResponse } from "../host/denial-response";
import { ProviderKeyMissingError } from "../host/errors";
import type { HostAdapter } from "../host/types";
import {
  completeImageJob,
  createImageJob,
  failImageJob,
  setImageJobProviderTaskId,
} from "../image-jobs";
import { getProvider } from "../providers";
import { buildReferenceImages } from "../reference-images";

export function createGenerateImageRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const userId = await host.auth.getUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          boardId?: string;
          nodeId?: string | null;
          prompt?: string;
          images?: Array<{ imageUrl: string; blobPath?: string }>;
          model?: string;
          settings?: Record<string, unknown>;
          variants?: number;
          previousBlobPath?: string | null;
          previousSize?: number | null;
          parentMediaId?: string | null;
          chatMessageId?: string | null;
          source?: "node" | "chat";
        }
      | null;

    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 },
      );
    }

    const boardId = typeof body.boardId === "string" ? body.boardId : "";
    if (!boardId) {
      return NextResponse.json(
        { success: false, error: "boardId is required" },
        { status: 400 },
      );
    }

    const model = typeof body.model === "string" ? body.model : "";
    const modelInfo = host.models.image[model];
    if (!modelInfo) {
      return NextResponse.json(
        { success: false, error: `Invalid model: ${model}` },
        { status: 400 },
      );
    }
    const provider = getProvider(host, modelInfo.provider);

    const settings: Record<string, unknown> =
      body.settings && typeof body.settings === "object" ? body.settings : {};
    const requestedVariants = Math.max(1, Math.min(body.variants ?? 1, 4));
    // Clamp to 1 for models whose upstream silently ignores a batch count.
    // Without this, a programmatic caller passing variants=4 would be
    // charged 4× while only receiving 1 image.
    const variants = modelInfo.supportsBatchGeneration
      ? Math.min(requestedVariants, modelInfo.maxBatchCount)
      : 1;
    const images = (body.images ?? []).filter(
      (i): i is { imageUrl: string; blobPath?: string } =>
        Boolean(i && typeof i.imageUrl === "string" && i.imageUrl.length > 0),
    );

    let providerSecret: string;
    try {
      providerSecret = await host.keys.resolveProviderKey(userId, modelInfo.provider);
    } catch (error) {
      if (!(error instanceof ProviderKeyMissingError)) throw error;
      console.error("[generate-image][config] provider key missing", {
        requestId,
        provider: error.provider,
        message: error.message,
      });
      return NextResponse.json(
        { success: false, error: error.hint, code: "provider_key_missing" },
        { status: 500 },
      );
    }

    const callbackBase = host.callbacks.publicBaseUrl();

    const resolvedSource: "node" | "chat" =
      body.source === "chat" ? "chat" : "node";
    const resolvedNodeId =
      typeof body.nodeId === "string" && body.nodeId.length > 0
        ? body.nodeId
        : null;
    const resolvedChatMessageId =
      resolvedSource === "chat" && typeof body.chatMessageId === "string"
        ? body.chatMessageId
        : null;
    const resolvedParentMediaId =
      typeof body.parentMediaId === "string" && body.parentMediaId.length > 0
        ? body.parentMediaId
        : null;

    const nonce = createId();
    const jobId = createId();

    const decision = await host.policy.beforeGenerate({
      kind: "image",
      userId,
      jobId,
      boardId,
      model,
      variants,
    });
    if (!decision.ok) {
      return denialResponse(decision);
    }
    const reservedMicro = decision.reservedMicro;

    let job;
    try {
      job = await createImageJob(host.db, {
        id: jobId,
        userId,
        boardId,
        nodeId: resolvedNodeId,
        chatMessageId: resolvedChatMessageId,
        source: resolvedSource,
        model,
        promptSnapshot: prompt,
        imagesSnapshot: images.map((i) => ({
          imageUrl: i.imageUrl,
          blobPath: i.blobPath,
        })),
        settingsSnapshot: settings,
        variants,
        reservedMicro,
        nonce,
        parentMediaId: resolvedParentMediaId,
        previousBlobPath:
          typeof body.previousBlobPath === "string"
            ? body.previousBlobPath
            : null,
        previousSize:
          typeof body.previousSize === "number" ? body.previousSize : null,
      });
    } catch (err) {
      console.error("[generate-image][create-job-error]", { requestId, err });
      await host.policy.afterGenerate({
        kind: "image",
        status: "failed",
        userId,
        jobId,
        reservedMicro,
        reason: "Failed to persist job row",
      });
      return NextResponse.json(
        { success: false, error: "Failed to enqueue image job" },
        { status: 500 },
      );
    }

    const callBackUrl =
      callbackBase === null
        ? null
        : `${callbackBase}/api/webhook/${provider.info.id}/image/${job.id}/${nonce}`;

    const referenceImages = modelInfo.supportsImageInput
      ? buildReferenceImages(host, images.map((i) => i.imageUrl))
      : [];

    let created;
    try {
      created = await provider.createImageTask({
        model,
        providerModel: modelInfo.providerModel,
        prompt,
        referenceImages,
        settings,
        variants,
        callBackUrl,
        secret: providerSecret,
        signal: request.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider request failed";
      await failImageJob(host, job, message);
      return NextResponse.json({ success: false, error: message, jobId: job.id }, { status: 502 });
    }

    if (!created.ok) {
      await failImageJob(host, job, created.message);
      return NextResponse.json(
        { success: false, error: created.message, jobId: job.id },
        { status: created.status },
      );
    }

    if (created.mode === "sync") {
      const outcome = await completeImageJob(host, job, created.assets);
      if (outcome.status === "failed") {
        return NextResponse.json(
          { success: false, error: outcome.error, jobId: job.id },
          { status: 502 },
        );
      }
      return NextResponse.json({ success: true, jobId: job.id, status: "completed" });
    }

    await setImageJobProviderTaskId(host.db, job.id, created.taskId);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "processing",
    });
  }

  return { POST };
}
