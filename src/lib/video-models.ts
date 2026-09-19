// Centralized video model definitions
// Used by: video-node.tsx (UI dropdown), route.ts (API), SEO pages (fallback list)

export interface VideoModelOption {
  value: string;
  label: string;
  cost: number;
  // Model can accept an image input (image-to-video). Text-to-video still
  // works on these unless `requiresImage` is also set.
  supportsImage: boolean;
  // Model cannot run without an image — true image-only models. Default false.
  requiresImage?: boolean;
  isComingSoon?: boolean;
}

export interface VideoModelSettings {
  duration: string;
  nFrames: string;
  aspectRatio: string;
  mode: string;
  sound: boolean;
  resolution: string;
  size: string;
  quality: string;
  promptOptimizer: boolean;
  fixedLens: boolean;
  generateAudio: boolean;
  removeWatermark: boolean;
}

export type VideoModelSettingOptions = {
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
};

export const DEFAULT_VIDEO_MODEL_SETTINGS: VideoModelSettings = {
  duration: "5",
  nFrames: "10",
  aspectRatio: "16:9",
  mode: "pro",
  sound: false,
  resolution: "720p",
  size: "high",
  quality: "720p",
  promptOptimizer: true,
  fixedLens: false,
  generateAudio: false,
  removeWatermark: true,
};

// Video models available in the flow editor for generation
export const VIDEO_MODELS: VideoModelOption[] = [
  { value: "kie/kling-3-0", label: "Kling 3.0", cost: 0.40, supportsImage: true },
  { value: "kie/wan-2-6", label: "Wan 2.6", cost: 0.35, supportsImage: true },
  { value: "kie/kling-2-6", label: "Kling 2.6", cost: 0.38, supportsImage: true },
  { value: "kie/grok-imagine", label: "Grok Imagine", cost: 0.35, supportsImage: true },
  { value: "kie/hailuo-2-3", label: "Hailuo 2.3", cost: 0.35, supportsImage: true },
  { value: "kie/sora-2-pro-storyboard", label: "Sora 2 Pro Storyboard", cost: 0.50, supportsImage: true },
  { value: "kie/sora-2-pro", label: "Sora 2 Pro", cost: 0.45, supportsImage: true },
  { value: "kie/seedance-2-5", label: "Seedance 2.5", cost: 0.60, supportsImage: true },
  { value: "kie/seedance-2-0", label: "Seedance 2.0", cost: 0.33, supportsImage: true },
  { value: "kie/seedance-2-fast", label: "Seedance 2.0 Fast", cost: 0.25, supportsImage: true },
  // Seedance 1.5 Pro stays hidden from the picker — superseded by 2.x.
  // Existing boards that reference it keep working; config/rate entries
  // are kept intact.
  // { value: "kie/seedance-1-5-pro", label: "Seedance 1.5 Pro", cost: 0.40, supportsImage: true },
  { value: "kie/sora-2", label: "Sora 2", cost: 0.40, supportsImage: true },
  { value: "kie/kling-2-5", label: "Kling 2.5", cost: 0.35, supportsImage: true },
  { value: "kie/runway", label: "Runway Gen-3", cost: 0.40, supportsImage: true },
  { value: "kie/veo3", label: "Veo 3", cost: 0.40, supportsImage: true },
  { value: "google/veo-3.1-generate-preview", label: "Veo 3.1", cost: 0.40, supportsImage: true },
  { value: "google/veo-3.1-fast-generate-preview", label: "Veo 3.1 Fast", cost: 0.15, supportsImage: true },
  { value: "google/veo-3.1-lite-generate-preview", label: "Veo 3.1 Lite", cost: 0.10, supportsImage: true },
  { value: "openai/sora-2", label: "Sora 2", cost: 0.40, supportsImage: true },
  { value: "openai/sora-2-pro", label: "Sora 2 Pro", cost: 0.80, supportsImage: true },
];

// Models from providers the host has not enabled are hidden from the picker.
export function videoModelsForProviders(enabled: readonly string[]): VideoModelOption[] {
  return VIDEO_MODELS.filter((model) => enabled.includes(model.value.split("/")[0]));
}

export const VIDEO_MODEL_SETTING_OPTIONS: Record<string, VideoModelSettingOptions> = {
  "google/veo-3.1-generate-preview": {
    durations: ["4", "6", "8"],
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
  },
  "google/veo-3.1-fast-generate-preview": {
    durations: ["4", "6", "8"],
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
  },
  "google/veo-3.1-lite-generate-preview": {
    durations: ["4", "6", "8"],
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
  },
  "openai/sora-2": {
    durations: ["4", "8", "12"],
    aspectRatios: ["16:9", "9:16"],
  },
  "openai/sora-2-pro": {
    durations: ["4", "8", "12"],
    aspectRatios: ["16:9", "9:16"],
  },
  "kie/kling-3-0": {
    durations: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    modes: ["std", "pro"],
    sounds: [true, false],
  },
  "kie/kling-2-6": {
    durations: ["5", "10"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    sounds: [true, false],
  },
  "kie/kling-2-5": {
    durations: ["5", "10"],
    aspectRatios: ["16:9", "9:16", "1:1"],
  },
  "kie/wan-2-6": {
    durations: ["5", "10"],
    resolutions: ["1080p", "720p"],
  },
  "kie/grok-imagine": {
    durations: ["5", "6", "8", "10"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    modes: ["normal"],
    resolutions: ["480p"],
  },
  "kie/hailuo-2-3": {
    durations: ["6", "10"],
    resolutions: ["768P"],
    promptOptimizers: [true, false],
  },
  "kie/sora-2-pro-storyboard": {
    durations: ["10", "15"],
    aspectRatios: ["landscape"],
  },
  "kie/sora-2-pro": {
    nFrames: ["5", "10", "15"],
    aspectRatios: ["landscape"],
    sizes: ["standard", "high"],
    removeWatermarkOptions: [true, false],
  },
  "kie/sora-2": {
    nFrames: ["5", "10", "15"],
    aspectRatios: ["landscape"],
    removeWatermarkOptions: [true, false],
  },
  "kie/seedance-1-5-pro": {
    durations: ["5", "8", "10"],
    aspectRatios: ["1:1", "16:9", "9:16"],
    resolutions: ["720p"],
    fixedLensOptions: [false, true],
    generateAudioOptions: [false, true],
  },
  "kie/seedance-2-0": {
    durationRange: [4, 15],
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
    resolutions: ["480p", "720p", "1080p"],
    generateAudioOptions: [false, true],
  },
  "kie/seedance-2-fast": {
    durationRange: [4, 15],
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
    // Kie does not offer 1080p on the Fast variant.
    resolutions: ["480p", "720p"],
    generateAudioOptions: [false, true],
  },
  "kie/seedance-2-5": {
    durationRange: [4, 30],
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
    resolutions: ["480p", "720p", "1080p"],
    generateAudioOptions: [false, true],
  },
  // Legacy direct-BytePlus keys, now served by the Kie models above.
  "seedance-2": {
    durationRange: [4, 15],
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
    resolutions: ["480p", "720p", "1080p"],
    generateAudioOptions: [false, true],
  },
  "seedance-2-fast": {
    durationRange: [4, 15],
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
    resolutions: ["480p", "720p"],
    generateAudioOptions: [false, true],
  },
  "kie/runway": {
    durations: ["5", "10"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    qualities: ["720p"],
  },
  "kie/veo3": {
    aspectRatios: ["16:9", "9:16", "1:1"],
  },
};

// Fallback model list for SEO ranking pages when API is unavailable
export const FALLBACK_VIDEO_MODELS = [
  { id: "1", name: "Kling 3.0", slug: "kling-3-0", model_creator: { id: "k3", name: "Kuaishou" }, elo: 1380 },
  { id: "2", name: "Runway Gen-4.5", slug: "runway-gen-4-5", model_creator: { id: "rw", name: "Runway" }, elo: 1350 },
  { id: "3", name: "Veo 3", slug: "google-veo", model_creator: { id: "gv", name: "Google" }, elo: 1320 },
  { id: "4", name: "Sora 2 Pro", slug: "sora-2-pro", model_creator: { id: "s2p", name: "OpenAI" }, elo: 1310 },
  { id: "5", name: "Sora 2", slug: "sora-2", model_creator: { id: "s2", name: "OpenAI" }, elo: 1300 },
  { id: "6", name: "Wan 2.6", slug: "wan-2-6", model_creator: { id: "w26", name: "Alibaba" }, elo: 1290 },
  { id: "7", name: "Kling 2.6", slug: "kling-2-6", model_creator: { id: "k26", name: "Kuaishou" }, elo: 1285 },
  { id: "8", name: "Kling 2.5", slug: "kling-2-5", model_creator: { id: "k25", name: "Kuaishou" }, elo: 1280 },
  { id: "9", name: "Seedance 1.5 Pro", slug: "seedance-1-5-pro", model_creator: { id: "sd15", name: "ByteDance" }, elo: 1270 },
  { id: "10", name: "Hailuo 2.3", slug: "hailuo-2-3", model_creator: { id: "h23", name: "MiniMax" }, elo: 1260 },
  { id: "11", name: "Grok Imagine", slug: "grok-imagine", model_creator: { id: "gi", name: "xAI" }, elo: 1250 },
  { id: "12", name: "Sora 2 Pro Storyboard", slug: "sora-2-pro-storyboard", model_creator: { id: "s2ps", name: "OpenAI" }, elo: 1235 },
  { id: "13", name: "Dream Machine", slug: "luma-dream-machine", model_creator: { id: "dm", name: "Luma Labs" }, elo: 1220 },
  { id: "14", name: "Seedance 2.0", slug: "seedance-2-0", model_creator: { id: "sd20", name: "ByteDance" }, elo: 1210 },
];

// Detailed fallback list for detail pages (includes extra fields)
export const FALLBACK_VIDEO_MODELS_DETAIL = FALLBACK_VIDEO_MODELS.map((m, i) => ({
  ...m,
  rank: i + 1,
  appearances: 5000 - (i * 200),
  release_date: "2025-01-01",
}));
