import { SORA_SETTINGS, VEO_SETTINGS, type VideoSettingOptions } from "./model-options";
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
  // The settings the model accepts and their allowed values; the server
  // validates requests against them (see resolveVideoSettings).
  settings: VideoSettingOptions;
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
    settings: VEO_SETTINGS,
  },
  "google/veo-3.1-fast-generate-preview": {
    label: "Veo 3.1 Fast",
    provider: "google",
    providerModel: "veo-3.1-fast-generate-preview",
    supportsImageInput: true,
    defaultDuration: 8,
    settings: VEO_SETTINGS,
  },
  "google/veo-3.1-lite-generate-preview": {
    label: "Veo 3.1 Lite",
    provider: "google",
    providerModel: "veo-3.1-lite-generate-preview",
    supportsImageInput: true,
    defaultDuration: 8,
    settings: VEO_SETTINGS,
  },
};

export const OPENAI_VIDEO_MODELS: Record<string, VideoModelInfo> = {
  "openai/sora-2": {
    label: "Sora 2",
    provider: "openai",
    providerModel: "sora-2",
    supportsImageInput: true,
    defaultDuration: 4,
    settings: SORA_SETTINGS,
  },
  "openai/sora-2-pro": {
    label: "Sora 2 Pro",
    provider: "openai",
    providerModel: "sora-2-pro",
    supportsImageInput: true,
    defaultDuration: 4,
    settings: SORA_SETTINGS,
  },
};

export type SpeechVoice = { id: string; label: string; sampleUrl: string | null };

export type SpeechModelInfo = {
  label: string;
  provider: ProviderId;
  providerModel: string;
  maxCharacters: number;
  voices: SpeechVoice[];
};

const OPENAI_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
const GEMINI_VOICES = ["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"];
const voiceList = (ids: string[]): SpeechVoice[] =>
  ids.map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1), sampleUrl: null }));

export const OPENAI_SPEECH_MODELS: Record<string, SpeechModelInfo> = {
  "openai/gpt-4o-mini-tts": { label: "OpenAI TTS", provider: "openai", providerModel: "gpt-4o-mini-tts", maxCharacters: 600, voices: voiceList(OPENAI_VOICES) },
};

export const GOOGLE_SPEECH_MODELS: Record<string, SpeechModelInfo> = {
  "google/gemini-3.8-flash-tts": { label: "Gemini TTS", provider: "google", providerModel: "gemini-3.8-flash-tts", maxCharacters: 600, voices: voiceList(GEMINI_VOICES) },
  "google/gemini-3.8-flash-lite-tts": { label: "Gemini TTS Lite", provider: "google", providerModel: "gemini-3.8-flash-lite-tts", maxCharacters: 600, voices: voiceList(GEMINI_VOICES) },
};
