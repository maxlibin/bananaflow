import { NextResponse, type NextRequest } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { denialResponse } from "../host/denial-response";
import { ProviderKeyMissingError } from "../host/errors";
import type { HostAdapter } from "../host/types";
import {
  IMAGE_MODELS,
  createImageProviderTask,
  type ImageModelKey,
} from "../image-generation-service";
import {
  createImageJob,
  failImageJob,
  setImageJobProviderTaskId,
} from "../image-jobs";

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

    const modelKey = body.model ?? "kie/4o-image";
    if (!(modelKey in IMAGE_MODELS)) {
      return NextResponse.json(
        { success: false, error: `Invalid model: ${modelKey}` },
        { status: 400 },
      );
    }
    const model = modelKey as ImageModelKey;

    const settings: Record<string, unknown> =
      body.settings && typeof body.settings === "object" ? body.settings : {};
    const requestedVariants = Math.max(1, Math.min(body.variants ?? 1, 4));
    // Clamp to 1 for models whose upstream silently ignores nVariants > 1
    // (e.g. kie/4o-image — Kie echoes back nVariants=1 regardless of input).
    // Without this, a programmatic caller passing variants=4 would be
    // charged 4× while only receiving 1 image.
    const modelCfg = IMAGE_MODELS[model];
    const variants =
      modelCfg.supportsBatchGeneration === false ? 1 : requestedVariants;
    const images = (body.images ?? []).filter(
      (i): i is { imageUrl: string; blobPath?: string } =>
        Boolean(i && typeof i.imageUrl === "string" && i.imageUrl.length > 0),
    );

    let providerSecret: string;
    try {
      providerSecret = await host.keys.resolveProviderKey(userId, "kie");
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
        : `${callbackBase}/api/webhook/kie/image/${job.id}/${nonce}`;

    const created = await createImageProviderTask({
      model,
      prompt,
      imageUrls: images.map((i) => i.imageUrl),
      settings,
      callBackUrl,
      providerSecret,
    });

    if (!created.ok) {
      await failImageJob(host, job, created.message);
      return NextResponse.json(
        { success: false, error: created.message, jobId: job.id },
        { status: created.status },
      );
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
