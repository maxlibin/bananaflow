import type { HostAdapter } from "./host/types";
import {
  createAbortError,
  isAbortError,
  waitWithAbort,
} from "./generation-utils";
import {
  downloadGeneratedImages,
  extractGeneratedImageUrls,
  resolveImageTaskId,
} from "./image-generation-service";
import { IMAGE_MODELS } from "./image-models";
import { buildProviderUrl } from "./provider-api";

export type RunImageGenerationOnceInput = {
  userId: string;
  prompt: string;
  model: string;
  settings: Record<string, unknown>;
  imageUrls: string[];
  providerSecret: string;
  signal: AbortSignal;
  requestId: string;
};

export type RunImageGenerationOnceResult = {
  url: string;
  blobPath: string;
  fileSize: number;
};

export async function runImageGenerationOnce(
  host: HostAdapter,
  input: RunImageGenerationOnceInput,
): Promise<RunImageGenerationOnceResult> {
  const modelConfig = IMAGE_MODELS[input.model];
  if (!modelConfig) {
    throw new Error(`Invalid model: ${input.model}`);
  }

  const requestBody = modelConfig.buildBody(input.prompt, {
    aspectRatio:
      typeof input.settings.aspectRatio === "string"
        ? input.settings.aspectRatio
        : undefined,
    imageUrls: input.imageUrls.length > 0 ? input.imageUrls : undefined,
    imageSize:
      typeof input.settings.imageSize === "string"
        ? input.settings.imageSize
        : undefined,
    imageResolution:
      typeof input.settings.imageResolution === "string"
        ? input.settings.imageResolution
        : undefined,
    quality:
      typeof input.settings.quality === "string"
        ? input.settings.quality
        : undefined,
    style:
      typeof input.settings.style === "string"
        ? input.settings.style
        : undefined,
    renderingSpeed:
      typeof input.settings.renderingSpeed === "string"
        ? input.settings.renderingSpeed
        : undefined,
    outputFormat:
      typeof input.settings.outputFormat === "string"
        ? input.settings.outputFormat
        : undefined,
    nVariants: 1,
  });

  const createResponse = await fetch(buildProviderUrl(modelConfig.endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.providerSecret}`,
    },
    signal: input.signal,
    body: JSON.stringify(requestBody),
  });

  const createText = await createResponse.text();
  let createResult: Record<string, unknown>;
  try {
    createResult = JSON.parse(createText);
  } catch {
    throw new Error("Invalid response from provider on createTask");
  }
  if (!createResponse.ok) {
    throw new Error(
      `Provider createTask error ${createResponse.status}: ${createText.slice(0, 200)}`,
    );
  }

  const taskId = resolveImageTaskId(createResult, modelConfig.taskIdField);
  if (!taskId) {
    throw new Error("Provider returned no taskId");
  }

  const maxPolls = 60;
  const pollInterval = 5000;
  let pollCount = 0;
  let urls: string[] = [];

  while (pollCount < maxPolls) {
    if (input.signal.aborted) throw createAbortError();
    pollCount++;
    await waitWithAbort(pollInterval, input.signal);

    const statusUrl = `${buildProviderUrl(modelConfig.statusEndpoint)}?taskId=${taskId}`;
    const statusResponse = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${input.providerSecret}` },
      signal: input.signal,
    });
    if (!statusResponse.ok) continue;

    const statusText = await statusResponse.text();
    let statusResult: Record<string, unknown>;
    try {
      statusResult = JSON.parse(statusText);
    } catch {
      continue;
    }
    const data = (statusResult.data || statusResult) as Record<string, unknown>;
    const status = (data[modelConfig.statusField] ??
      statusResult[modelConfig.statusField] ??
      data.status ??
      statusResult.status) as string | number | undefined;

    if (status !== undefined && modelConfig.successStates.includes(status)) {
      urls = extractGeneratedImageUrls(statusResult, modelConfig);
      if (urls.length > 0) break;
    }
    if (status !== undefined && modelConfig.failStates.includes(status)) {
      throw new Error(`Provider task failed: status=${status}`);
    }
  }

  if (urls.length === 0) {
    throw new Error("Provider task timed out");
  }

  const downloaded = await downloadGeneratedImages(
    urls.slice(0, 1),
    input.signal,
  );
  if (downloaded.length === 0) {
    throw new Error("Failed to download generated image");
  }
  const image = downloaded[0];

  const filename = `${input.userId}/bulk-${input.requestId}-${Date.now()}.${image.ext}`;
  const blob = await host.storage.uploadAsset({
    key: filename,
    body: Buffer.from(image.buffer),
    contentType: image.contentType,
  });

  return {
    url: blob.url,
    blobPath: blob.pathname,
    fileSize: image.buffer.byteLength,
  };
}

export { isAbortError };
