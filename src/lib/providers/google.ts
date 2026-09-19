import {
  extensionForContentType,
  UnknownModelError,
  UnsupportedCallbackError,
  type GeneratedAsset,
  type ImageTaskInput,
  type Provider,
  type ProviderKeyCheck,
  type TaskStart,
  type TaskStatus,
  type VideoTaskInput,
} from "./types";

export const GOOGLE_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

type GoogleError = { error?: { message?: string; status?: string; code?: number } };

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as GoogleError;
    if (parsed.error?.message) return parsed.error.message;
  } catch {}
  return text.slice(0, 500) || `HTTP ${res.status}`;
}

type GenerateContentResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }> };
  }>;
  promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
};

async function createImageTask(input: ImageTaskInput): Promise<TaskStart> {
  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
  for (const image of input.referenceImages) {
    const { bytes, contentType } = await image.fetchBytes();
    parts.push({ inlineData: { mimeType: contentType, data: bytes.toString("base64") } });
  }

  const imageConfig: Record<string, string> = {};
  if (typeof input.settings.aspectRatio === "string" && input.settings.aspectRatio !== "auto") {
    imageConfig.aspectRatio = input.settings.aspectRatio;
  }
  if (typeof input.settings.imageResolution === "string") {
    imageConfig.imageSize = input.settings.imageResolution;
  }

  const res = await fetch(
    `${GOOGLE_API_BASE_URL}/models/${encodeURIComponent(input.providerModel)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": input.secret, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
        },
      }),
      signal: input.signal,
    },
  );
  if (!res.ok) return { ok: false, status: res.status, message: await readError(res) };

  const payload = (await res.json()) as GenerateContentResponse;
  if (payload.promptFeedback?.blockReason) {
    return {
      ok: false,
      status: 422,
      message: `Google blocked the prompt: ${payload.promptFeedback.blockReasonMessage ?? payload.promptFeedback.blockReason}`,
    };
  }
  const assets: GeneratedAsset[] = [];
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType) {
        assets.push({
          kind: "bytes",
          bytes: Buffer.from(part.inlineData.data, "base64"),
          contentType: part.inlineData.mimeType,
          ext: extensionForContentType(part.inlineData.mimeType),
        });
      }
    }
  }
  if (assets.length === 0) {
    const reason = payload.candidates?.[0]?.finishReason;
    return {
      ok: false,
      status: 502,
      message: reason ? `Google returned no image (finishReason ${reason})` : "Google returned no image",
    };
  }
  return { ok: true, mode: "sync", assets };
}

type Operation = {
  name?: string;
  done?: boolean;
  error?: { message?: string; code?: number };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{ video?: { uri?: string } }>;
      raiMediaFilteredCount?: number;
      raiMediaFilteredReasons?: string[];
    };
  };
};

async function createVideoTask(input: VideoTaskInput): Promise<TaskStart> {
  const instance: Record<string, unknown> = { prompt: input.prompt };
  const reference = input.referenceImages[0];
  if (reference) {
    const { bytes, contentType } = await reference.fetchBytes();
    instance.image = { bytesBase64Encoded: bytes.toString("base64"), mimeType: contentType };
  }
  const parameters: Record<string, unknown> = {
    aspectRatio: typeof input.settings.aspectRatio === "string" ? input.settings.aspectRatio : "16:9",
    durationSeconds: Number(input.settings.duration ?? 8),
  };
  if (typeof input.settings.resolution === "string") parameters.resolution = input.settings.resolution;

  const res = await fetch(
    `${GOOGLE_API_BASE_URL}/models/${encodeURIComponent(input.providerModel)}:predictLongRunning`,
    {
      method: "POST",
      headers: { "x-goog-api-key": input.secret, "Content-Type": "application/json" },
      body: JSON.stringify({ instances: [instance], parameters }),
    },
  );
  if (!res.ok) return { ok: false, status: res.status, message: await readError(res) };
  const operation = (await res.json()) as Operation;
  if (typeof operation.name !== "string") {
    return { ok: false, status: 502, message: "Google returned an operation without a name" };
  }
  return { ok: true, mode: "async", taskId: operation.name };
}

async function fetchVideoTask(model: string, taskId: string, secret: string): Promise<TaskStatus> {
  const headers = { "x-goog-api-key": secret };
  const res = await fetch(`${GOOGLE_API_BASE_URL}/${taskId}`, { headers });
  if (!res.ok) {
    if (res.status === 404) return { status: "failed", message: `Google operation ${taskId} not found` };
    return { status: "processing" };
  }
  const operation = (await res.json()) as Operation;
  if (!operation.done) return { status: "processing" };
  if (operation.error) {
    return { status: "failed", message: operation.error.message ?? "Google reported the video as failed" };
  }
  const video = operation.response?.generateVideoResponse;
  const uri = video?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    const filtered = video?.raiMediaFilteredReasons?.join("; ");
    return {
      status: "failed",
      message: filtered ? `Google filtered the video: ${filtered}` : "Google returned no video",
    };
  }
  const download = await fetch(uri, { headers });
  if (!download.ok) {
    return { status: "failed", message: `Google video download failed: ${await readError(download)}` };
  }
  const contentType = download.headers.get("content-type") ?? "video/mp4";
  return {
    status: "completed",
    assets: [
      {
        kind: "bytes",
        bytes: Buffer.from(await download.arrayBuffer()),
        contentType,
        ext: extensionForContentType(contentType) === "bin" ? "mp4" : extensionForContentType(contentType),
      },
    ],
  };
}

async function checkKey(secret: string): Promise<ProviderKeyCheck> {
  const res = await fetch(`${GOOGLE_API_BASE_URL}/models?pageSize=1`, {
    headers: { "x-goog-api-key": secret },
  });
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, body: await readError(res) };
}

export const googleProvider: Provider = {
  id: "google",
  createImageTask,
  async fetchImageTask(model) {
    throw new UnknownModelError(`${model} (Gemini images do not create asynchronous tasks)`);
  },
  parseImageCallback() {
    throw new UnsupportedCallbackError("google");
  },
  createVideoTask,
  fetchVideoTask,
  parseVideoCallback() {
    throw new UnsupportedCallbackError("google");
  },
  checkKey,
};
