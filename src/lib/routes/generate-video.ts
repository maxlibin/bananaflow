import { NextResponse, type NextRequest } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { denialResponse } from "../host/denial-response";
import { ProviderKeyMissingError } from "../host/errors";
import type { HostAdapter } from "../host/types";
import { getProvider } from "../providers";
import { buildReferenceImages } from "../reference-images";
import type { VideoModelSettings } from "../video-models";
import {
  completeVideoJob,
  createVideoJob,
  failVideoJob,
  setVideoJobProviderTaskId,
} from "../video-jobs";

export function createGenerateVideoRoute(host: HostAdapter) {
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
          settings?: Partial<VideoModelSettings>;
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
    if (prompt.length === 0) {
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
    const modelConfig = host.models.video[model];
    if (!modelConfig) {
      return NextResponse.json(
        { success: false, error: `Invalid model: ${model}` },
        { status: 400 },
      );
    }
    const provider = getProvider(host, modelConfig.provider);

    const settings: Partial<VideoModelSettings> =
      body.settings && typeof body.settings === "object" ? body.settings : {};

    const billingDuration =
      (settings.duration as string | number | undefined) ??
      modelConfig.defaultDuration;
    const billingResolution =
      (settings.resolution as string | undefined) ??
      (settings.quality as string | undefined) ??
      (settings.size as string | undefined);

    // Models split audio across two settings fields: Seedance uses
    // `generateAudio`, Kling 3.0 / 2.6 use `sound`. Either being true means
    // the user requested audio and we should charge the audio rate.
    const audioRequested =
      settings.generateAudio === true || settings.sound === true;

    let providerSecret: string;
    try {
      providerSecret = await host.keys.resolveProviderKey(userId, modelConfig.provider);
    } catch (error) {
      if (!(error instanceof ProviderKeyMissingError)) throw error;
      console.error("[generate-video][config] provider key missing", {
        requestId,
        model,
        provider: error.provider,
        message: error.message,
      });
      return NextResponse.json(
        { success: false, error: error.hint, code: "provider_key_missing" },
        { status: 500 },
      );
    }

    const callbackBase = host.callbacks.publicBaseUrl();

    const images = (body.images ?? []).filter(
      (i): i is { imageUrl: string; blobPath?: string } =>
        Boolean(i && typeof i.imageUrl === "string" && i.imageUrl.length > 0),
    );
    const supportedImages = modelConfig.supportsImageInput ? images : [];

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
      kind: "video",
      userId,
      jobId,
      boardId,
      model,
      duration: billingDuration,
      resolution: billingResolution,
      generateAudio: audioRequested,
    });
    if (!decision.ok) {
      return denialResponse(decision);
    }
    const reservedMicro = decision.reservedMicro;

    // Persist the job so the row exists before the provider learns the callback URL.
    // Use the pre-generated jobId so the credit ledger's requestId
    // (video_job_${jobId}) matches the actual row id.
    let job;
    try {
      job = await createVideoJob(host.db, {
        id: jobId,
        userId,
        boardId,
        nodeId: resolvedNodeId,
        chatMessageId: resolvedChatMessageId,
        source: resolvedSource,
        model,
        promptSnapshot: prompt,
        imagesSnapshot: supportedImages.map((i) => ({
          imageUrl: i.imageUrl,
          blobPath: i.blobPath,
        })),
        settingsSnapshot: settings,
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
      console.error("[generate-video][create-job-error]", { requestId, err });
      await host.policy.afterGenerate({
        kind: "video",
        status: "failed",
        userId,
        jobId,
        reservedMicro,
        reason: "Failed to persist job row",
      });
      return NextResponse.json(
        { success: false, error: "Failed to enqueue video job" },
        { status: 500 },
      );
    }

    const callBackUrl =
      callbackBase === null
        ? null
        : `${callbackBase}/api/webhook/${provider.info.id}/video/${job.id}/${nonce}`;

    let created;
    try {
      created = await provider.createVideoTask({
        model,
        providerModel: modelConfig.providerModel,
        prompt,
        referenceImages: buildReferenceImages(host, supportedImages.map((i) => i.imageUrl)),
        settings,
        callBackUrl,
        secret: providerSecret,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider request failed";
      await failVideoJob(host, job, message);
      return NextResponse.json({ success: false, error: message, jobId: job.id }, { status: 502 });
    }

    if (!created.ok) {
      await failVideoJob(host, job, created.message);
      return NextResponse.json(
        { success: false, error: created.message, jobId: job.id },
        { status: created.status },
      );
    }

    if (created.mode === "sync") {
      const outcome = await completeVideoJob(host, job, created.assets);
      if (outcome.status === "failed") {
        return NextResponse.json(
          { success: false, error: outcome.error, jobId: job.id },
          { status: 502 },
        );
      }
      return NextResponse.json({ success: true, jobId: job.id, status: "completed" });
    }

    await setVideoJobProviderTaskId(host.db, job.id, created.taskId);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "processing",
    });
  }

  return { POST };
}
