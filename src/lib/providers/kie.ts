import {
  KIE_IMAGE_MODELS,
  createImageProviderTask,
  extractGeneratedImageUrls,
  extractGenerationStatus,
  fetchImageProviderTaskStatus,
  getProviderMessage,
  statusMatchesState,
  type KieImageModelKey,
} from "../image-generation-service";
import { KIE_API_BASE_URL } from "../provider-api";
import {
  KIE_VIDEO_MODELS,
  createProviderTask,
  extractGeneratedVideoUrl,
  extractGenerationStatus as extractVideoStatus,
  fetchProviderTaskStatus,
  getProviderMessage as getVideoMessage,
  statusMatchesState as videoStatusMatches,
  type KieVideoModelKey,
} from "../video-generation-service";
import {
  UnknownModelError,
  type Provider,
  type ProviderKeyCheck,
  type TaskStatus,
} from "./types";

// Kie.ai aggregates many upstream models behind one key. Every task is
// asynchronous: create returns a task id, status is polled or delivered by
// webhook, and finished assets arrive as public URLs.

function requireImageModel(model: string): KieImageModelKey {
  if (!(model in KIE_IMAGE_MODELS)) throw new UnknownModelError(model);
  return model as KieImageModelKey;
}

function requireVideoModel(model: string): KieVideoModelKey {
  if (!(model in KIE_VIDEO_MODELS)) throw new UnknownModelError(model);
  return model as KieVideoModelKey;
}

export function imageStatusFromPayload(
  model: string,
  payload: Record<string, unknown>,
): TaskStatus {
  const cfg = KIE_IMAGE_MODELS[requireImageModel(model)];
  const providerStatus = extractGenerationStatus(payload, cfg.statusField);
  // Webhook payloads sometimes omit the status field; URL presence = success.
  const urls = extractGeneratedImageUrls(payload, { imageUrlField: cfg.imageUrlField });

  if (statusMatchesState(providerStatus, cfg.failStates)) {
    return { status: "failed", message: getProviderMessage(payload, "Image generation failed") };
  }
  const completed = statusMatchesState(providerStatus, cfg.successStates);
  if (!completed && urls.length === 0) return { status: "processing" };
  if (urls.length === 0) {
    return { status: "failed", message: "Provider reported success without image URLs" };
  }
  return { status: "completed", assets: urls.map((url) => ({ kind: "url", url })) };
}

export function videoStatusFromPayload(
  model: string,
  payload: Record<string, unknown>,
): TaskStatus {
  const cfg = KIE_VIDEO_MODELS[requireVideoModel(model)];
  const providerStatus = extractVideoStatus(payload, cfg.statusField);
  // Kie sends two payload shapes:
  //  - Polling response: { data: { state: "success", url: ... } }   (state field present)
  //  - Webhook callback: { code: 200, data: { video_url: ... }, msg: "..." } (no state, just URL)
  // For the webhook shape, the presence of a video URL with no explicit fail
  // state is the success signal.
  const url = extractGeneratedVideoUrl(payload, cfg.videoUrlField);

  if (videoStatusMatches(providerStatus, cfg.failStates)) {
    return { status: "failed", message: getVideoMessage(payload, "Video generation failed") };
  }
  const completed = videoStatusMatches(providerStatus, cfg.successStates);
  if (!completed && !url) return { status: "processing" };
  if (!url) return { status: "failed", message: "Provider reported success without a video URL" };
  return { status: "completed", assets: [{ kind: "url", url }] };
}

async function checkKey(secret: string): Promise<ProviderKeyCheck> {
  const res = await fetch(`${KIE_API_BASE_URL}/api/v1/chat/credit`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: body.slice(0, 500) };
  let parsed: { code?: number; msg?: string };
  try {
    parsed = JSON.parse(body) as { code?: number; msg?: string };
  } catch {
    return { ok: false, status: res.status, body: body.slice(0, 500) };
  }
  if (parsed.code !== undefined && parsed.code !== 200) {
    return { ok: false, status: parsed.code, body: parsed.msg ?? body.slice(0, 500) };
  }
  return { ok: true };
}

export const kieProvider: Provider = {
  id: "kie",

  async createImageTask(input) {
    const model = requireImageModel(input.model);
    const created = await createImageProviderTask({
      model,
      prompt: input.prompt,
      imageUrls: input.referenceImages.map((image) => image.publicUrl),
      settings: input.settings,
      callBackUrl: input.callBackUrl,
      providerSecret: input.secret,
    });
    if (!created.ok) return created;
    return { ok: true, mode: "async", taskId: created.taskId };
  },

  async fetchImageTask(model, taskId, secret) {
    const result = await fetchImageProviderTaskStatus(requireImageModel(model), taskId, secret);
    if (!result.ok) return { status: "processing" };
    return imageStatusFromPayload(model, result.payload);
  },

  parseImageCallback(model, payload) {
    return imageStatusFromPayload(model, payload);
  },

  async createVideoTask(input) {
    const model = requireVideoModel(input.model);
    const created = await createProviderTask({
      model,
      prompt: input.prompt,
      images: input.referenceImages.map((image) => ({ imageUrl: image.publicUrl })),
      settings: input.settings,
      callBackUrl: input.callBackUrl,
      providerSecret: input.secret,
    });
    if (!created.ok) return created;
    return { ok: true, mode: "async", taskId: created.taskId };
  },

  async fetchVideoTask(model, taskId, secret) {
    const result = await fetchProviderTaskStatus(requireVideoModel(model), taskId, secret);
    if (!result.ok) return { status: "processing" };
    return videoStatusFromPayload(model, result.payload);
  },

  parseVideoCallback(model, payload) {
    return videoStatusFromPayload(model, payload);
  },

  checkKey,
};
