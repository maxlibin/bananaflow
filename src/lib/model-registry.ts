import type { ProviderId } from "./providers/types";

// Server-side description of a model. Deployments compose their own
// `HostAdapter.models` from the per-provider maps below.
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
export const OPENAI_IMAGE_MODELS: Record<string, ImageModelInfo> = {
  "openai/gpt-image-1": openaiImage("gpt-image-1", "GPT Image 1"),
  "openai/gpt-image-1-mini": openaiImage("gpt-image-1-mini", "GPT Image 1 Mini"),
  "openai/gpt-image-1.5": openaiImage("gpt-image-1.5", "GPT Image 1.5"),
  "openai/gpt-image-2": openaiImage("gpt-image-2", "GPT Image 2"),
  "openai/gpt-image-2.5-flare": openaiImage("gpt-image-2.5-flare", "GPT Image 2.5 Flare"),
  "openai/gpt-image-2.5-sunburst": openaiImage("gpt-image-2.5-sunburst", "GPT Image 2.5 Sunburst"),
};

export const GOOGLE_IMAGE_MODELS: Record<string, ImageModelInfo> = {
  "google/gemini-2.5-flash-image": googleImage("gemini-2.5-flash-image", "Nano Banana"),
  "google/gemini-3-pro-image": googleImage("gemini-3-pro-image", "Nano Banana Pro"),
  "google/gemini-3.1-flash-image": googleImage("gemini-3.1-flash-image", "Nano Banana 2"),
  "google/gemini-3.1-flash-lite-image": googleImage("gemini-3.1-flash-lite-image", "Nano Banana 2 Lite"),
};

export const GOOGLE_VIDEO_MODELS: Record<string, VideoModelInfo> = {
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
};

export const OPENAI_VIDEO_MODELS: Record<string, VideoModelInfo> = {
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
