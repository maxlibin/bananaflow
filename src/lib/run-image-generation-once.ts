import type { HostAdapter } from "./host/types";
import { getProvider } from "./providers";
import { UnknownModelError } from "./providers/types";
import { buildReferenceImages } from "./reference-images";
import { runImageTaskToCompletion } from "./run-image-task";
import { isAbortError } from "./generation-utils";

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

// Used by the bulk queue: one prompt in, one stored image out.
export async function runImageGenerationOnce(
  host: HostAdapter,
  input: RunImageGenerationOnceInput,
): Promise<RunImageGenerationOnceResult> {
  const info = host.models.image[input.model];
  if (!info) throw new UnknownModelError(input.model);

  const assets = await runImageTaskToCompletion({
    provider: getProvider(host, info.provider),
    task: {
      model: input.model,
      providerModel: info.providerModel,
      prompt: input.prompt,
      referenceImages: info.supportsImageInput ? buildReferenceImages(host, input.imageUrls) : [],
      settings: input.settings,
      variants: 1,
      callBackUrl: null,
      secret: input.providerSecret,
      signal: input.signal,
    },
    pollIntervalMs: 5000,
    maxPolls: 60,
  });
  const image = assets[0];
  if (!image) throw new Error("Provider returned no image");

  const filename = `${input.userId}/bulk-${input.requestId}-${Date.now()}.${image.ext}`;
  const blob = await host.storage.uploadAsset({
    key: filename,
    body: image.bytes,
    contentType: image.contentType,
  });

  return {
    url: blob.url,
    blobPath: blob.pathname,
    fileSize: image.bytes.byteLength,
  };
}

export { isAbortError };
