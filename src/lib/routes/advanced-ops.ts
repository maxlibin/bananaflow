import { NextResponse, type NextRequest } from "next/server";
import { runAdvancedOperation, type ProviderResult } from "../advanced-node-pipeline";
import { toProviderAssetUrl } from "../asset-urls";
import type { AdvancedOpId } from "../advanced-ops";
import { waitWithAbort } from "../generation-utils";
import type { HostAdapter } from "../host/types";
import {
  downloadGeneratedImages,
  extractGeneratedImageUrls,
  resolveImageTaskId,
} from "../image-generation-service";
import { IMAGE_MODELS, type ImageModelConfig } from "../image-models";
import { buildProviderUrl } from "../provider-api";

// All three advanced ops are prompt-engineered calls to the same editing
// model, polled inline for up to five minutes.
const ADVANCED_OP_MODEL = "kie/nano-banana-pro";
const POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 5000;

type BuildBodyOptions = Parameters<ImageModelConfig["buildBody"]>[1];

async function runEditingModel(input: {
  prompt: string;
  bodyOptions: BuildBodyOptions;
  signal: AbortSignal;
  providerSecret: string;
  timeoutMessage: string;
}): Promise<ProviderResult> {
  const modelConfig = IMAGE_MODELS[ADVANCED_OP_MODEL];
  if (!modelConfig) throw new Error(`Model ${ADVANCED_OP_MODEL} not registered`);

  const requestBody = modelConfig.buildBody(input.prompt, input.bodyOptions);

  const createRes = await fetch(buildProviderUrl(modelConfig.endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.providerSecret}`,
    },
    signal: input.signal,
    body: JSON.stringify(requestBody),
  });
  const createJson = (await createRes.json()) as Record<string, unknown>;
  if (!createRes.ok) throw new Error(`Provider create failed: ${createRes.status}`);

  const taskId = resolveImageTaskId(createJson, modelConfig.taskIdField);
  if (!taskId) throw new Error("Provider did not return a task id");

  let urls: string[] = [];
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    if (input.signal.aborted) throw new Error("aborted");
    await waitWithAbort(POLL_INTERVAL_MS, input.signal);
    const statusRes = await fetch(
      `${buildProviderUrl(modelConfig.statusEndpoint)}?taskId=${taskId}`,
      { headers: { Authorization: `Bearer ${input.providerSecret}` }, signal: input.signal },
    );
    if (!statusRes.ok) continue;
    const statusJson = (await statusRes.json()) as Record<string, unknown>;
    const data = (statusJson.data ?? statusJson) as Record<string, unknown>;
    const status =
      data[modelConfig.statusField] ?? data.status ?? data.successFlag ?? data.taskStatus;
    if (status !== undefined && modelConfig.successStates.includes(status as never)) {
      urls = extractGeneratedImageUrls(statusJson, modelConfig);
      if (urls.length > 0) break;
    }
    if (status !== undefined && modelConfig.failStates.includes(status as never)) {
      throw new Error("Provider reported failure");
    }
  }

  if (urls.length === 0) throw new Error(input.timeoutMessage);

  const downloaded = await downloadGeneratedImages(urls, input.signal);
  if (downloaded.length === 0) throw new Error("Failed to download result");
  const first = downloaded[0];
  return { buffer: first.buffer, contentType: first.contentType, ext: first.ext };
}

export function createUpscaleRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    const body = (await request.clone().json()) as { imageUrl?: string; factor?: 2 | 4 };
    const factor: 2 | 4 = body.factor === 4 ? 4 : 2;
    const op: AdvancedOpId = factor === 4 ? "upscale_4x" : "upscale_2x";

    if (!body.imageUrl) {
      return NextResponse.json({ success: false, error: "imageUrl is required" }, { status: 400 });
    }
    const imageUrl = body.imageUrl;

    return runAdvancedOperation(host, {
      request,
      op,
      feature: "IMAGE_UPSCALE",
      fileNameBase: `upscaled-${factor}x`,
      extraUsageMetadata: { factor, sourceUrl: imageUrl.slice(0, 200) },
      callProvider: ({ signal, providerSecret }) =>
        runEditingModel({
          prompt: `Upscale this image to ${factor}x resolution. Preserve all details, sharpness, and colors. Do not change composition.`,
          bodyOptions: { imageUrls: [toProviderAssetUrl(host, imageUrl)], nVariants: 1 },
          signal,
          providerSecret,
          timeoutMessage: "Upscale timed out",
        }),
    });
  }

  return { POST };
}

export function createRemoveBgRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    const body = (await request.clone().json()) as { imageUrl?: string };
    if (!body.imageUrl) {
      return NextResponse.json({ success: false, error: "imageUrl is required" }, { status: 400 });
    }
    const imageUrl = body.imageUrl;

    return runAdvancedOperation(host, {
      request,
      op: "remove_bg",
      feature: "BACKGROUND_REMOVAL",
      fileNameBase: "removed-bg",
      extraUsageMetadata: { sourceUrl: imageUrl.slice(0, 200) },
      callProvider: ({ signal, providerSecret }) =>
        runEditingModel({
          prompt:
            "Remove the background of this image completely. Output a transparent PNG with only the main subject, cleanly cut out along the edges.",
          bodyOptions: { imageUrls: [toProviderAssetUrl(host, imageUrl)], outputFormat: "png", nVariants: 1 },
          signal,
          providerSecret,
          timeoutMessage: "Background removal timed out",
        }),
    });
  }

  return { POST };
}

export function createFaceConsistencyRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    const body = (await request.clone().json()) as {
      prompt?: string;
      referenceImageUrl?: string;
      aspectRatio?: string;
    };

    if (!body.prompt) {
      return NextResponse.json({ success: false, error: "prompt is required" }, { status: 400 });
    }
    if (!body.referenceImageUrl) {
      return NextResponse.json(
        { success: false, error: "referenceImageUrl is required" },
        { status: 400 },
      );
    }
    const prompt = body.prompt;
    const referenceImageUrl = body.referenceImageUrl;
    const aspectRatio = body.aspectRatio;

    return runAdvancedOperation(host, {
      request,
      op: "face_consistency",
      feature: "FACE_CONSISTENCY",
      fileNameBase: "face-consistent",
      extraUsageMetadata: { referenceUrl: referenceImageUrl.slice(0, 200) },
      callProvider: ({ signal, providerSecret }) =>
        runEditingModel({
          prompt: `Keep the same face, identity, and distinguishing features as the reference image. Scene: ${prompt}`,
          bodyOptions: { imageUrls: [toProviderAssetUrl(host, referenceImageUrl)], aspectRatio, nVariants: 1 },
          signal,
          providerSecret,
          timeoutMessage: "Face consistency timed out",
        }),
    });
  }

  return { POST };
}
