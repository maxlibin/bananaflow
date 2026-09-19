import { KIE_IMAGE_MODELS } from "./image-models";
import type { ProviderId } from "./providers/types";
import { KIE_VIDEO_MODELS } from "./video-generation-service";

export type ImageModelInfo = {
  label: string;
  provider: ProviderId;
  // The identifier the provider's API expects.
  providerModel: string;
  supportsImageInput: boolean;
  supportsBatchGeneration: boolean;
  maxBatchCount: number;
};

export type VideoModelInfo = {
  label: string;
  provider: ProviderId;
  providerModel: string;
  supportsImageInput: boolean;
  defaultDuration: number;
};

const kieImageModels: Record<string, ImageModelInfo> = Object.fromEntries(
  Object.entries(KIE_IMAGE_MODELS).map(([key, config]) => [
    key,
    {
      label: config.label,
      provider: "kie",
      providerModel: key,
      supportsImageInput: config.supportsImageInput,
      supportsBatchGeneration: config.supportsBatchGeneration !== false,
      maxBatchCount: config.maxBatchCount ?? 1,
    },
  ]),
);

const kieVideoModels: Record<string, VideoModelInfo> = Object.fromEntries(
  Object.entries(KIE_VIDEO_MODELS).map(([key, config]) => [
    key,
    {
      label: config.label,
      provider: "kie",
      providerModel: key,
      supportsImageInput: config.supportsImageInput,
      defaultDuration: config.defaultDuration,
    },
  ]),
);

function openaiImage(providerModel: string, label: string): ImageModelInfo {
  return {
    label,
    provider: "openai",
    providerModel,
    supportsImageInput: true,
    supportsBatchGeneration: true,
    maxBatchCount: 4,
  };
}

function googleImage(providerModel: string, label: string): ImageModelInfo {
  return {
    label,
    provider: "google",
    providerModel,
    supportsImageInput: true,
    // Gemini image models return one image per request.
    supportsBatchGeneration: false,
    maxBatchCount: 1,
  };
}

// Model ids verified against the live OpenAI and Google APIs on 2026-09-20.
export const IMAGE_MODELS: Record<string, ImageModelInfo> = {
  ...kieImageModels,
  "openai/gpt-image-1": openaiImage("gpt-image-1", "GPT Image 1"),
  "openai/gpt-image-1-mini": openaiImage("gpt-image-1-mini", "GPT Image 1 Mini"),
  "openai/gpt-image-1.5": openaiImage("gpt-image-1.5", "GPT Image 1.5"),
  "openai/gpt-image-2": openaiImage("gpt-image-2", "GPT Image 2"),
  "openai/gpt-image-2.5-flare": openaiImage("gpt-image-2.5-flare", "GPT Image 2.5 Flare"),
  "openai/gpt-image-2.5-sunburst": openaiImage("gpt-image-2.5-sunburst", "GPT Image 2.5 Sunburst"),
  "google/gemini-2.5-flash-image": googleImage("gemini-2.5-flash-image", "Nano Banana"),
  "google/gemini-3-pro-image": googleImage("gemini-3-pro-image", "Nano Banana Pro"),
  "google/gemini-3.1-flash-image": googleImage("gemini-3.1-flash-image", "Nano Banana 2"),
  "google/gemini-3.1-flash-lite-image": googleImage("gemini-3.1-flash-lite-image", "Nano Banana 2 Lite"),
};

export const VIDEO_MODELS: Record<string, VideoModelInfo> = {
  ...kieVideoModels,
  "google/veo-3.1-generate-preview": {
    label: "Veo 3.1",
    provider: "google",
    providerModel: "veo-3.1-generate-preview",
    supportsImageInput: true,
    defaultDuration: 8,
  },
  "google/veo-3.1-fast-generate-preview": {
    label: "Veo 3.1 Fast",
    provider: "google",
    providerModel: "veo-3.1-fast-generate-preview",
    supportsImageInput: true,
    defaultDuration: 8,
  },
  "google/veo-3.1-lite-generate-preview": {
    label: "Veo 3.1 Lite",
    provider: "google",
    providerModel: "veo-3.1-lite-generate-preview",
    supportsImageInput: true,
    defaultDuration: 8,
  },
  "openai/sora-2": {
    label: "Sora 2",
    provider: "openai",
    providerModel: "sora-2",
    supportsImageInput: true,
    defaultDuration: 4,
  },
  "openai/sora-2-pro": {
    label: "Sora 2 Pro",
    provider: "openai",
    providerModel: "sora-2-pro",
    supportsImageInput: true,
    defaultDuration: 4,
  },
};

export type ImageModelKey = keyof typeof IMAGE_MODELS;
export type VideoModelKey = keyof typeof VIDEO_MODELS;

// The prompt-engineered editing model used by upscale, background removal
// and face consistency, per provider. Hosts enable providers in preference
// order; the first enabled entry wins.
export const EDIT_MODEL_BY_PROVIDER: Record<ProviderId, string> = {
  google: "google/gemini-2.5-flash-image",
  openai: "openai/gpt-image-1",
  kie: "kie/nano-banana-pro",
};

export function isImageModel(key: string): key is ImageModelKey {
  return key in IMAGE_MODELS;
}

export function isVideoModel(key: string): key is VideoModelKey {
  return key in VIDEO_MODELS;
}
