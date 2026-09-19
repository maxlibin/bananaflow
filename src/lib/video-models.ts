// Video generation settings shared by the video node, the routes and the
// providers. Model lists live in the host (see model-options.ts).
export type { VideoModelOption, VideoSettingOptions as VideoModelSettingOptions } from "./model-options";

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
