import type { SpeechModelInfo, SpeechVoice } from "./model-registry";
// Client-side model pickers and their per-model setting options. A
// deployment composes `CanvasHost.models` from these and any of its own.

export type ImageModelOption = { value: string; label: string };

// A language model offered for script writing.
export type TextModelOption = { id: string; label: string; description: string };

export type ImageSettingOptions = {
  aspectRatios?: string[];
  // Some models only allow certain resolutions for certain aspect ratios.
  // Maps an aspect ratio to the resolutions that remain valid for it.
  resolutionsByAspectRatio?: Record<string, string[]>;
  imageSizes?: string[];
  imageResolutions?: string[];
  qualities?: string[];
  styles?: string[];
  renderingSpeeds?: string[];
  outputFormats?: string[];
  variantCounts?: number[];
};

export type VideoModelOption = {
  value: string;
  label: string;
  // Indicative provider cost per clip in USD, shown nowhere by default.
  cost: number;
  supportsImage: boolean;
  requiresImage?: boolean;
  isComingSoon?: boolean;
};

export type VideoSettingOptions = {
  durations?: string[];
  // When set, the duration UI renders a slider with [min, max] in seconds
  // (integer step). Takes precedence over `durations`.
  durationRange?: [number, number];
  nFrames?: string[];
  aspectRatios?: string[];
  modes?: string[];
  sounds?: boolean[];
  resolutions?: string[];
  sizes?: string[];
  qualities?: string[];
  promptOptimizers?: boolean[];
  fixedLensOptions?: boolean[];
  generateAudioOptions?: boolean[];
  removeWatermarkOptions?: boolean[];
  // The model can end the clip on a second image (first-and-last-frame mode).
  supportsLastFrame?: boolean;
  // Several shots in one clip, each with its own prompt and length.
  multiShot?: VideoMultiShotOptions;
};

export type VideoMultiShotOptions = {
  maxShots: number;
  shotSeconds: [number, number];
  totalSeconds: [number, number];
  promptChars: number;
};

export type CanvasModels = {
  image: ImageModelOption[];
  // Image model used by default for shot keyframes and entity reference
  // sheets; it must take several reference images and keep identities.
  referenceImageModel: string;
  imageSettings: Record<string, ImageSettingOptions>;
  video: VideoModelOption[];
  videoSettings: Record<string, VideoSettingOptions>;
  speech: SpeechModelOption[];
};

const OPENAI_IMAGE_SETTINGS: ImageSettingOptions = {
  aspectRatios: ["1:1", "3:2", "2:3", "auto"],
  qualities: ["auto", "low", "medium", "high"],
  outputFormats: ["png", "jpeg", "webp"],
  variantCounts: [1, 2, 3, 4],
};

const GEMINI_IMAGE_ASPECT_RATIOS = [
  "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto",
];

export const OPENAI_IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  { value: "openai/gpt-image-1", label: "GPT Image 1" },
  { value: "openai/gpt-image-1-mini", label: "GPT Image 1 Mini" },
  { value: "openai/gpt-image-1.5", label: "GPT Image 1.5" },
  { value: "openai/gpt-image-2", label: "GPT Image 2" },
  { value: "openai/gpt-image-2.5-flare", label: "GPT Image 2.5 Flare" },
  { value: "openai/gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst" },
];

export const OPENAI_IMAGE_SETTING_OPTIONS: Record<string, ImageSettingOptions> = Object.fromEntries(
  OPENAI_IMAGE_MODEL_OPTIONS.map((model) => [model.value, OPENAI_IMAGE_SETTINGS]),
);

export const GOOGLE_IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  { value: "google/gemini-2.5-flash-image", label: "Nano Banana" },
  { value: "google/gemini-3-pro-image", label: "Nano Banana Pro" },
  { value: "google/gemini-3.1-flash-image", label: "Nano Banana 2" },
  { value: "google/gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite" },
];

export const GOOGLE_IMAGE_SETTING_OPTIONS: Record<string, ImageSettingOptions> = {
  "google/gemini-2.5-flash-image": { aspectRatios: GEMINI_IMAGE_ASPECT_RATIOS },
  "google/gemini-3-pro-image": {
    aspectRatios: GEMINI_IMAGE_ASPECT_RATIOS,
    imageResolutions: ["1K", "2K", "4K"],
  },
  "google/gemini-3.1-flash-image": {
    aspectRatios: GEMINI_IMAGE_ASPECT_RATIOS,
    imageResolutions: ["1K", "2K", "4K"],
  },
  "google/gemini-3.1-flash-lite-image": { aspectRatios: GEMINI_IMAGE_ASPECT_RATIOS },
};

export const VEO_SETTINGS: VideoSettingOptions = {
  durations: ["4", "6", "8"],
  aspectRatios: ["16:9", "9:16"],
  resolutions: ["720p", "1080p"],
  supportsLastFrame: true,
};

export const SORA_SETTINGS: VideoSettingOptions = {
  durations: ["4", "8", "12"],
  aspectRatios: ["16:9", "9:16"],
};

export const GOOGLE_VIDEO_MODEL_OPTIONS: VideoModelOption[] = [
  { value: "google/veo-3.1-generate-preview", label: "Veo 3.1", cost: 0.4, supportsImage: true },
  { value: "google/veo-3.1-fast-generate-preview", label: "Veo 3.1 Fast", cost: 0.15, supportsImage: true },
  { value: "google/veo-3.1-lite-generate-preview", label: "Veo 3.1 Lite", cost: 0.1, supportsImage: true },
];

export const GOOGLE_VIDEO_SETTING_OPTIONS: Record<string, VideoSettingOptions> = Object.fromEntries(
  GOOGLE_VIDEO_MODEL_OPTIONS.map((model) => [model.value, VEO_SETTINGS]),
);

export const OPENAI_VIDEO_MODEL_OPTIONS: VideoModelOption[] = [
  { value: "openai/sora-2", label: "Sora 2", cost: 0.4, supportsImage: true },
  { value: "openai/sora-2-pro", label: "Sora 2 Pro", cost: 0.8, supportsImage: true },
];

export const OPENAI_VIDEO_SETTING_OPTIONS: Record<string, VideoSettingOptions> = Object.fromEntries(
  OPENAI_VIDEO_MODEL_OPTIONS.map((model) => [model.value, SORA_SETTINGS]),
);

export type SpeechModelOption = { value: string; label: string; voices: SpeechVoice[] };

export function speechOptions(models: Record<string, SpeechModelInfo>): SpeechModelOption[] {
  return Object.entries(models).map(([value, info]) => ({ value, label: info.label, voices: info.voices }));
}
