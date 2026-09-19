import type { CanvasModels } from "../../lib/model-options";
import {
  GOOGLE_IMAGE_MODEL_OPTIONS,
  GOOGLE_IMAGE_SETTING_OPTIONS,
  GOOGLE_VIDEO_MODEL_OPTIONS,
  GOOGLE_VIDEO_SETTING_OPTIONS,
  OPENAI_IMAGE_MODEL_OPTIONS,
  OPENAI_IMAGE_SETTING_OPTIONS,
  OPENAI_VIDEO_MODEL_OPTIONS,
  OPENAI_VIDEO_SETTING_OPTIONS,
} from "../../lib/model-options";
import {
  GOOGLE_IMAGE_MODELS,
  GOOGLE_VIDEO_MODELS,
  OPENAI_IMAGE_MODELS,
  OPENAI_VIDEO_MODELS,
  type ImageModelInfo,
  type VideoModelInfo,
} from "../../lib/model-registry";
import { googleProvider } from "../../lib/providers/google";
import { openaiProvider } from "../../lib/providers/openai";
import type { Provider } from "../../lib/providers/types";

// Providers the open-source app talks to directly, in preference order.
// The first one with an editing model powers upscale, background removal
// and face consistency.
export const LOCAL_PROVIDERS: Provider[] = [googleProvider, openaiProvider];

export const LOCAL_IMAGE_MODELS: Record<string, ImageModelInfo> = {
  ...GOOGLE_IMAGE_MODELS,
  ...OPENAI_IMAGE_MODELS,
};

export const LOCAL_VIDEO_MODELS: Record<string, VideoModelInfo> = {
  ...GOOGLE_VIDEO_MODELS,
  ...OPENAI_VIDEO_MODELS,
};

// Client-side picker lists. Kept next to the server maps so both sides
// describe the same models.
export const LOCAL_CANVAS_MODELS: CanvasModels = {
  image: [...GOOGLE_IMAGE_MODEL_OPTIONS, ...OPENAI_IMAGE_MODEL_OPTIONS],
  imageSettings: { ...GOOGLE_IMAGE_SETTING_OPTIONS, ...OPENAI_IMAGE_SETTING_OPTIONS },
  video: [...GOOGLE_VIDEO_MODEL_OPTIONS, ...OPENAI_VIDEO_MODEL_OPTIONS],
  videoSettings: { ...GOOGLE_VIDEO_SETTING_OPTIONS, ...OPENAI_VIDEO_SETTING_OPTIONS },
};
