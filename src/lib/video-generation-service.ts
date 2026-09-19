import {
  findAllUrls,
  findTaskId,
  parseJsonObject,
} from "./generation-utils";
import { KIE_API_BASE_URL } from "./provider-api";
import type { VideoModelSettings } from "./video-models";

type VideoModelConfigLike = {
  defaultDuration: number;
  taskIdField: string;
  videoUrlField: string;
  apiModelName?: string;
  apiModelNameI2V?: string;
};

export type VideoModelConfig = {
  label: string;
  endpoint: string;
  statusEndpoint: string;
  costPerVideo: number;
  defaultDuration: number;
  supportsImageInput: boolean;
  provider: string;
  taskIdField: string;
  statusField: string;
  successStates: readonly (string | number)[];
  failStates: readonly (string | number)[];
  videoUrlField: string;
  apiModelName?: string;
  apiModelNameI2V?: string;
  pollIntervalMs?: number;
  maxPolls?: number;
};

export const KIE_VIDEO_MODELS = {
  "kie/runway": {
    label: "Runway Gen-3",
    endpoint: "/api/v1/runway/generate",
    statusEndpoint: "/api/v1/runway/record-detail",
    costPerVideo: 0.40,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success"] as const,
    failStates: ["fail"] as const,
    videoUrlField: "url",
  },
  "kie/veo3": {
    label: "Veo 3",
    endpoint: "/api/v1/veo/generate",
    statusEndpoint: "/api/v1/veo/record-info",
    costPerVideo: 0.40,
    defaultDuration: 8,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "successFlag",
    successStates: [1, "1"] as const,
    failStates: [2, 3, "2", "3"] as const,
    videoUrlField: "videoUrl",
    pollIntervalMs: 10000,
    maxPolls: 90,
  },
  "kie/kling-3-0": {
    label: "Kling 3.0",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.40,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "kling-3.0/video",
    maxPolls: 72,
  },
  "kie/kling-2-6": {
    label: "Kling 2.6",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.38,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "kling-2.6/text-to-video",
    apiModelNameI2V: "kling-2.6/image-to-video",
    maxPolls: 60,
  },
  "kie/kling-2-5": {
    label: "Kling 2.5",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.35,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "kling/v2-5-turbo-text-to-video-pro",
    apiModelNameI2V: "kling/v2-5-turbo-image-to-video-pro",
    maxPolls: 60,
  },
  "kie/wan-2-6": {
    label: "Wan 2.6",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.35,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "wan/2-6-text-to-video",
    apiModelNameI2V: "wan/2-6-image-to-video",
    maxPolls: 60,
  },
  "kie/grok-imagine": {
    label: "Grok Imagine",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.35,
    defaultDuration: 6,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "grok-imagine/text-to-video",
    apiModelNameI2V: "grok-imagine/image-to-video",
    maxPolls: 60,
  },
  "kie/hailuo-2-3": {
    label: "Hailuo 2.3",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.35,
    defaultDuration: 6,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "hailuo/02-text-to-video-pro",
    apiModelNameI2V: "hailuo/2-3-image-to-video-pro",
    maxPolls: 60,
  },
  "kie/sora-2-pro-storyboard": {
    label: "Sora 2 Pro Storyboard",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.50,
    defaultDuration: 15,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "sora-2-pro-storyboard",
    maxPolls: 90,
  },
  "kie/sora-2-pro": {
    label: "Sora 2 Pro",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.45,
    defaultDuration: 10,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "sora-2-pro-text-to-video",
    apiModelNameI2V: "sora-2-pro-image-to-video",
    maxPolls: 90,
  },
  "kie/seedance-1-5-pro": {
    label: "Seedance 1.5 Pro",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.40,
    defaultDuration: 8,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "bytedance/seedance-1.5-pro",
    maxPolls: 75,
  },
  "kie/sora-2": {
    label: "Sora 2",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.40,
    defaultDuration: 10,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "sora-2-text-to-video",
    apiModelNameI2V: "sora-2-image-to-video",
    maxPolls: 90,
  },
  "kie/seedance-2-0": {
    label: "Seedance 2.0",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.33,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "bytedance/seedance-2",
    maxPolls: 75,
  },
  "kie/seedance-2-fast": {
    label: "Seedance 2.0 Fast",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.25,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "bytedance/seedance-2-fast",
    maxPolls: 60,
  },
  "kie/seedance-2-5": {
    label: "Seedance 2.5",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.60,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "bytedance/seedance-2-5",
    maxPolls: 120,
  },
  // Legacy keys from the short-lived direct-BytePlus integration. Boards
  // saved between 2026-05 and 2026-08 still store them, so they stay
  // registered (hidden from the picker) and now resolve to the same Kie
  // models above. Rates in credits-config.ts alias the Kie ones too.
  "seedance-2": {
    label: "Bytedance Seedance 2",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.33,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "bytedance/seedance-2",
    maxPolls: 75,
  },
  "seedance-2-fast": {
    label: "Bytedance Seedance 2 Fast",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    costPerVideo: 0.25,
    defaultDuration: 5,
    supportsImageInput: true,
    provider: "kie",
    taskIdField: "taskId",
    statusField: "state",
    successStates: ["success", "completed"] as const,
    failStates: ["fail", "failed", "error"] as const,
    videoUrlField: "videoUrl",
    apiModelName: "bytedance/seedance-2-fast",
    maxPolls: 60,
  },
} as const satisfies Record<string, VideoModelConfig>;

export type KieVideoModelKey = keyof typeof KIE_VIDEO_MODELS;

export function normalizeStateValue(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "boolean") return String(value);
  return "";
}

export function statusMatchesState(
  status: unknown,
  states: readonly (string | number)[],
): boolean {
  const n = normalizeStateValue(status);
  if (!n) return false;
  return states.some((state) => normalizeStateValue(state) === n);
}

export function isProviderSuccessCode(code: unknown): boolean {
  if (code === undefined || code === null) return true;
  const n = normalizeStateValue(code);
  return n === "200" || n === "0";
}

export function getProviderMessage(
  result: Record<string, unknown>,
  fallback: string,
): string {
  const data = (result.data || result) as Record<string, unknown>;
  const candidates: unknown[] = [
    result.error,
    result.errorMessage,
    result.failMsg,
    result.fail_msg,
    data.msg,
    data.error,
    data.errorMessage,
    data.failMsg,
    data.fail_msg,
    result.msg,
    result.message,
    data.message,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const value = candidate.trim();
      if (normalizeStateValue(value) === "success") continue;
      return value;
    }
  }
  return fallback;
}

export function extractGenerationStatus(
  result: Record<string, unknown>,
  statusField: string,
): unknown {
  const data = (result.data || result) as Record<string, unknown>;
  return (
    data[statusField] ??
    result[statusField] ??
    data.status ??
    result.status ??
    data.state ??
    result.state ??
    data.successFlag ??
    result.successFlag ??
    data.taskStatus ??
    result.taskStatus
  );
}

export function buildVideoRequestBody(options: {
  model: string;
  prompt: string;
  imageUrl?: string;
  imageUrls?: string[];
  settings?: Partial<VideoModelSettings>;
  modelConfig: VideoModelConfigLike;
}): Record<string, unknown> {
  const { model, prompt, imageUrl, imageUrls, settings, modelConfig } = options;
  const duration =
    typeof settings?.duration === "string" && settings.duration.length > 0
      ? settings.duration
      : String(modelConfig.defaultDuration);
  const aspectRatio =
    typeof settings?.aspectRatio === "string" && settings.aspectRatio.length > 0
      ? settings.aspectRatio
      : "16:9";

  if (model === "kie/runway") {
    return {
      prompt,
      duration: Number.parseInt(duration, 10) || modelConfig.defaultDuration,
      quality:
        typeof settings?.quality === "string" && settings.quality.length > 0
          ? settings.quality
          : "720p",
      aspectRatio,
      waterMark: "",
      ...(imageUrl && { imageUrl }),
    };
  }

  if (model === "kie/veo3") {
    return {
      prompt,
      model: "veo3",
      aspect_ratio: aspectRatio,
      ...(imageUrl && { imageUrls: [imageUrl] }),
    };
  }

  const apiModel =
    imageUrl && modelConfig.apiModelNameI2V
      ? modelConfig.apiModelNameI2V
      : modelConfig.apiModelName;
  const resolvedApiModel = apiModel ?? model;

  if (model === "kie/kling-3-0") {
    return {
      model: resolvedApiModel,
      input: {
        prompt,
        duration,
        sound: typeof settings?.sound === "boolean" ? settings.sound : false,
        mode:
          typeof settings?.mode === "string" && settings.mode.length > 0
            ? settings.mode
            : "pro",
        multi_shots: false,
        ...(imageUrl
          ? { image_urls: [imageUrl] }
          : { aspect_ratio: aspectRatio }),
      },
    };
  }

  if (model === "kie/kling-2-6") {
    return {
      model: resolvedApiModel,
      input: {
        prompt,
        sound: typeof settings?.sound === "boolean" ? settings.sound : false,
        duration,
        ...(imageUrl
          ? { image_urls: [imageUrl] }
          : {
              aspect_ratio: aspectRatio,
            }),
      },
    };
  }

  if (model === "kie/kling-2-5") {
    return {
      model: resolvedApiModel,
      input: {
        prompt,
        duration,
        ...(imageUrl
          ? { image_url: imageUrl }
          : { aspect_ratio: aspectRatio }),
        negative_prompt: "blur, distort, and low quality",
        cfg_scale: 0.5,
      },
    };
  }

  if (model === "kie/wan-2-6") {
    return {
      model: resolvedApiModel,
      input: {
        prompt,
        duration,
        // Must match the rate billed when `resolution` is absent: the route
        // falls back to the model's `default` rate, which is the 720p tier.
        resolution:
          typeof settings?.resolution === "string" && settings.resolution.length > 0
            ? settings.resolution
            : "720p",
        ...(imageUrl ? { image_urls: [imageUrl] } : {}),
      },
    };
  }

  if (model === "kie/grok-imagine") {
    return {
      model: resolvedApiModel,
      input: {
        prompt,
        duration,
        resolution:
          typeof settings?.resolution === "string" && settings.resolution.length > 0
            ? settings.resolution
            : "480p",
        mode:
          typeof settings?.mode === "string" && settings.mode.length > 0
            ? settings.mode
            : "normal",
        ...(imageUrl ? { image_urls: [imageUrl] } : { aspect_ratio: aspectRatio }),
      },
    };
  }

  if (model === "kie/hailuo-2-3") {
    return {
      model: resolvedApiModel,
      input: imageUrl
        ? {
            prompt,
            image_url: imageUrl,
            duration,
            resolution:
              typeof settings?.resolution === "string" &&
              settings.resolution.length > 0
                ? settings.resolution
                : "768P",
          }
        : {
            prompt,
            prompt_optimizer:
              typeof settings?.promptOptimizer === "boolean"
                ? settings.promptOptimizer
                : true,
          },
    };
  }

  if (model === "kie/sora-2-pro-storyboard") {
    return {
      model: resolvedApiModel,
      input: {
        n_frames: duration,
        aspect_ratio:
          typeof settings?.aspectRatio === "string" &&
          settings.aspectRatio.length > 0
            ? settings.aspectRatio
            : "landscape",
        upload_method: "s3",
        shots: [
          {
            Scene: prompt,
            duration: Number(duration),
          },
        ],
        ...(imageUrl ? { image_urls: [imageUrl] } : {}),
      },
    };
  }

  if (model === "kie/sora-2-pro") {
    return {
      model: resolvedApiModel,
      input: {
        prompt,
        aspect_ratio:
          typeof settings?.aspectRatio === "string" &&
          settings.aspectRatio.length > 0
            ? settings.aspectRatio
            : "landscape",
        n_frames:
          typeof settings?.nFrames === "string" && settings.nFrames.length > 0
            ? settings.nFrames
            : duration,
        size:
          typeof settings?.size === "string" && settings.size.length > 0
            ? settings.size
            : imageUrl
              ? "standard"
              : "high",
        remove_watermark:
          typeof settings?.removeWatermark === "boolean"
            ? settings.removeWatermark
            : true,
        upload_method: "s3",
        ...(imageUrl ? { image_urls: [imageUrl] } : {}),
      },
    };
  }

  if (model === "kie/sora-2") {
    return {
      model: resolvedApiModel,
      input: {
        prompt,
        aspect_ratio:
          typeof settings?.aspectRatio === "string" &&
          settings.aspectRatio.length > 0
            ? settings.aspectRatio
            : "landscape",
        n_frames:
          typeof settings?.nFrames === "string" && settings.nFrames.length > 0
            ? settings.nFrames
            : duration,
        remove_watermark:
          typeof settings?.removeWatermark === "boolean"
            ? settings.removeWatermark
            : true,
        upload_method: "s3",
        ...(imageUrl ? { image_urls: [imageUrl] } : {}),
      },
    };
  }

  if (model === "kie/seedance-1-5-pro") {
    return {
      model: resolvedApiModel,
      input: {
        prompt,
        aspect_ratio:
          typeof settings?.aspectRatio === "string" &&
          settings.aspectRatio.length > 0
            ? settings.aspectRatio
            : "1:1",
        duration,
        resolution:
          typeof settings?.resolution === "string" && settings.resolution.length > 0
            ? settings.resolution
            : "720p",
        fixed_lens:
          typeof settings?.fixedLens === "boolean" ? settings.fixedLens : false,
        generate_audio:
          typeof settings?.generateAudio === "boolean"
            ? settings.generateAudio
            : false,
        ...(imageUrl ? { input_urls: [imageUrl] } : {}),
      },
    };
  }

  if (
    model === "kie/seedance-2-0" ||
    model === "kie/seedance-2-fast" ||
    model === "kie/seedance-2-5" ||
    model === "seedance-2" ||
    model === "seedance-2-fast"
  ) {
    // Kie exposes two mutually exclusive image scenarios on Seedance 2.x:
    // `first_frame_url` (the image becomes frame 1) and
    // `reference_image_urls` (images steer subject/style across shots).
    // One connected image reads as "animate this frame"; several only make
    // sense as references, and users address them positionally in the
    // prompt as `@Image1`, `@Image2`, ... for multi-shot narratives.
    const refImageUrls =
      imageUrls && imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [];
    const imageInput =
      refImageUrls.length > 1
        ? { reference_image_urls: refImageUrls }
        : refImageUrls.length === 1
          ? { first_frame_url: refImageUrls[0] }
          : {};
    return {
      model: resolvedApiModel,
      input: {
        prompt,
        web_search: false,
        aspect_ratio:
          typeof settings?.aspectRatio === "string" &&
          settings.aspectRatio.length > 0
            ? settings.aspectRatio
            : "16:9",
        duration: Number.parseInt(duration, 10) || modelConfig.defaultDuration,
        resolution:
          typeof settings?.resolution === "string" && settings.resolution.length > 0
            ? settings.resolution
            : "720p",
        // Default false, not kie's true: the billing path in
        // generate-video/route.ts treats a missing `generateAudio` as "no
        // audio", so defaulting to true here would generate the pricier
        // audio variant while charging the base rate.
        generate_audio:
          typeof settings?.generateAudio === "boolean"
            ? settings.generateAudio
            : false,
        ...imageInput,
      },
    };
  }

  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    duration,
  };

  if (imageUrl) {
    input.image_url = imageUrl;
  }

  return {
    model: resolvedApiModel,
    input,
  };
}

export function resolveVideoTaskId(
  createResult: Record<string, unknown>,
  taskIdField: string
): string | undefined {
  const createData =
    parseJsonObject(createResult.data) ||
    (createResult.data as Record<string, unknown> | undefined);

  const taskId =
    createData?.[taskIdField] ||
    createResult[taskIdField] ||
    createData?.task_id ||
    createResult.task_id ||
    findTaskId(createData) ||
    findTaskId(createResult);

  return typeof taskId === "string" ? taskId : undefined;
}

export function extractGeneratedVideoUrl(
  statusResult: Record<string, unknown>,
  videoUrlField: string
): string | undefined {
  const data = (statusResult.data || statusResult) as Record<string, unknown>;
  const videoInfo = data.videoInfo as Record<string, unknown> | undefined;
  const output = data.output as Record<string, unknown> | undefined;
  const result = data.result as Record<string, unknown> | undefined;
  const content = (statusResult.content || data.content) as
    | Record<string, unknown>
    | undefined;
  const statusData = statusResult.data as Record<string, unknown> | undefined;
  const parsedResultJson =
    parseJsonObject(data.resultJson) ||
    parseJsonObject(statusData?.resultJson) ||
    parseJsonObject(statusResult.resultJson);
  const responsePayload =
    parseJsonObject(data.response) ||
    parseJsonObject(statusData?.response) ||
    parseJsonObject(parsedResultJson?.response);

  const directCandidates: unknown[] = [
    data[videoUrlField],
    statusResult[videoUrlField],
    videoInfo?.videoUrl,
    videoInfo?.url,
    data.url,
    data.video_url,
    data.videoUrl,
    output?.url,
    result?.url,
    data.video,
    content?.video_url,
    content?.videoUrl,
    content?.url,
    statusData?.url,
    parsedResultJson?.url,
    parsedResultJson?.videoUrl,
    parsedResultJson?.video_url,
    parsedResultJson?.resultUrls,
    parsedResultJson?.result_urls,
    responsePayload?.url,
    responsePayload?.videoUrl,
    responsePayload?.video_url,
    responsePayload?.resultUrls,
    responsePayload?.result_urls,
    data.resultUrls,
    data.result_urls,
    output?.resultUrls,
    output?.result_urls,
    result?.resultUrls,
    result?.result_urls,
  ];

  const collectedUrls: string[] = [];
  for (const candidate of directCandidates) {
    if (!candidate) {
      continue;
    }
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        collectedUrls.push(trimmed);
      }
      continue;
    }
    collectedUrls.push(...findAllUrls(candidate));
  }

  const uniqueUrls = Array.from(new Set(collectedUrls));
  const isLikelyVideoUrl = (url: string) =>
    /\.(mp4|mov|webm|m3u8|avi|mkv)(\?|#|$)/i.test(url) ||
    /\/video\b/i.test(url);
  const isLikelyImageUrl = (url: string) =>
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(url) ||
    url.includes("/_next/image?");

  for (const url of uniqueUrls) {
    if (isLikelyVideoUrl(url)) {
      return url;
    }
  }

  for (const url of uniqueUrls) {
    if (!isLikelyImageUrl(url)) {
      return url;
    }
  }

  const focusedFallbackUrls = findAllUrls({
    statusData,
    videoInfo,
    output,
    result,
    parsedResultJson,
    responsePayload,
  });

  for (const url of focusedFallbackUrls) {
    if (isLikelyVideoUrl(url)) {
      return url;
    }
  }

  return focusedFallbackUrls.find((url) => !isLikelyImageUrl(url));
}

export interface CreateProviderTaskInput {
  model: KieVideoModelKey;
  prompt: string;
  images: Array<{ imageUrl: string }>;
  settings: Partial<VideoModelSettings>;
  // null when the host has no public origin; the poller finalizes the job.
  callBackUrl: string | null;
  providerSecret: string;
}

export async function createProviderTask(
  input: CreateProviderTaskInput,
): Promise<
  | { ok: true; taskId: string }
  | { ok: false; status: number; message: string }
> {
  const config = KIE_VIDEO_MODELS[input.model];
  const body = buildVideoRequestBody({
    model: input.model,
    prompt: input.prompt,
    imageUrl: input.images[0]?.imageUrl,
    imageUrls: input.images.map((i) => i.imageUrl),
    settings: input.settings,
    modelConfig: config,
  });
  const bodyWithCallback =
    input.callBackUrl === null ? body : { ...body, callBackUrl: input.callBackUrl };
  const requestUrl = `${KIE_API_BASE_URL}${config.endpoint}`;

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${input.providerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyWithCallback),
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message: err instanceof Error ? err.message : "Provider fetch failed",
    };
  }

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 502, message: "Provider returned non-JSON" };
  }
  if (!isProviderSuccessCode((parsed as { code?: unknown }).code)) {
    return {
      ok: false,
      status: 502,
      message: getProviderMessage(parsed, "Provider rejected the task"),
    };
  }
  const taskId = resolveVideoTaskId(parsed, config.taskIdField);
  if (!taskId) {
    return { ok: false, status: 502, message: "Provider response missing taskId" };
  }
  return { ok: true, taskId };
}

export async function fetchProviderTaskStatus(
  model: KieVideoModelKey,
  taskId: string,
  providerSecret: string,
): Promise<
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; status: number; message: string }
> {
  const config = KIE_VIDEO_MODELS[model];
  const url = `${KIE_API_BASE_URL}${config.statusEndpoint}?taskId=${encodeURIComponent(taskId)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${providerSecret}` },
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message: err instanceof Error ? err.message : "Provider fetch failed",
    };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, message: `Provider HTTP ${res.status}` };
  }
  const text = await res.text();
  try {
    return { ok: true, payload: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { ok: false, status: 502, message: "Provider returned non-JSON status" };
  }
}
