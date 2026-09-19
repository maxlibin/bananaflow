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

export const OPENAI_API_BASE_URL = "https://api.openai.com/v1";

// Image sizes the Images API accepts, keyed by the canvas aspect-ratio option.
const IMAGE_SIZE_BY_ASPECT: Record<string, string> = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
  auto: "auto",
};

// Sora sizes, keyed by aspect ratio; the pro model also offers the larger sizes.
const VIDEO_SIZE_BY_ASPECT: Record<string, { standard: string; pro: string }> = {
  "16:9": { standard: "1280x720", pro: "1792x1024" },
  "9:16": { standard: "720x1280", pro: "1024x1792" },
};

type OpenAIError = { error?: { message?: string; type?: string; code?: string } };

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as OpenAIError;
    if (parsed.error?.message) return parsed.error.message;
  } catch {}
  return text.slice(0, 500) || `HTTP ${res.status}`;
}

function contentTypeForFormat(format: string): string {
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}

async function createImageTask(input: ImageTaskInput): Promise<TaskStart> {
  const aspect = typeof input.settings.aspectRatio === "string" ? input.settings.aspectRatio : "1:1";
  const size = IMAGE_SIZE_BY_ASPECT[aspect] ?? "1024x1024";
  const quality = typeof input.settings.quality === "string" ? input.settings.quality.toLowerCase() : "auto";
  const outputFormat =
    typeof input.settings.outputFormat === "string" ? input.settings.outputFormat.toLowerCase() : "png";
  const headers: Record<string, string> = { Authorization: `Bearer ${input.secret}` };

  let res: Response;
  if (input.referenceImages.length > 0) {
    // Edits take the reference images as multipart files.
    const form = new FormData();
    form.set("model", input.providerModel);
    form.set("prompt", input.prompt);
    form.set("n", String(input.variants));
    form.set("size", size);
    form.set("quality", quality);
    form.set("output_format", outputFormat);
    for (const [index, image] of input.referenceImages.entries()) {
      const { bytes, contentType } = await image.fetchBytes();
      form.append(
        "image[]",
        new Blob([new Uint8Array(bytes)], { type: contentType }),
        `reference-${index}.${extensionForContentType(contentType)}`,
      );
    }
    res = await fetch(`${OPENAI_API_BASE_URL}/images/edits`, {
      method: "POST",
      headers,
      body: form,
      signal: input.signal,
    });
  } else {
    res = await fetch(`${OPENAI_API_BASE_URL}/images/generations`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.providerModel,
        prompt: input.prompt,
        n: input.variants,
        size,
        quality,
        output_format: outputFormat,
      }),
      signal: input.signal,
    });
  }

  if (!res.ok) return { ok: false, status: res.status, message: await readError(res) };

  const payload = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    return { ok: false, status: 502, message: "OpenAI returned no images" };
  }
  const assets: GeneratedAsset[] = [];
  for (const item of payload.data) {
    if (typeof item.b64_json === "string") {
      assets.push({
        kind: "bytes",
        bytes: Buffer.from(item.b64_json, "base64"),
        contentType: contentTypeForFormat(outputFormat),
        ext: outputFormat === "jpeg" ? "jpg" : outputFormat,
      });
    } else if (typeof item.url === "string") {
      assets.push({ kind: "url", url: item.url });
    }
  }
  if (assets.length === 0) {
    return { ok: false, status: 502, message: "OpenAI returned images without data" };
  }
  return { ok: true, mode: "sync", assets };
}

type SoraJob = {
  id?: string;
  status?: string;
  error?: { message?: string } | null;
};

async function createVideoTask(input: VideoTaskInput): Promise<TaskStart> {
  const aspect = typeof input.settings.aspectRatio === "string" ? input.settings.aspectRatio : "16:9";
  const sizes = VIDEO_SIZE_BY_ASPECT[aspect] ?? VIDEO_SIZE_BY_ASPECT["16:9"];
  const size = input.providerModel === "sora-2-pro" ? sizes.pro : sizes.standard;
  const seconds = String(input.settings.duration ?? "4");

  const form = new FormData();
  form.set("model", input.providerModel);
  form.set("prompt", input.prompt);
  form.set("seconds", seconds);
  form.set("size", size);
  const reference = input.referenceImages[0];
  if (reference) {
    const { bytes, contentType } = await reference.fetchBytes();
    form.set(
      "input_reference",
      new Blob([new Uint8Array(bytes)], { type: contentType }),
      `reference.${extensionForContentType(contentType)}`,
    );
  }

  const res = await fetch(`${OPENAI_API_BASE_URL}/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.secret}` },
    body: form,
  });
  if (!res.ok) return { ok: false, status: res.status, message: await readError(res) };
  const job = (await res.json()) as SoraJob;
  if (typeof job.id !== "string") {
    return { ok: false, status: 502, message: "OpenAI returned a video job without an id" };
  }
  return { ok: true, mode: "async", taskId: job.id };
}

async function fetchVideoTask(model: string, taskId: string, secret: string): Promise<TaskStatus> {
  const headers = { Authorization: `Bearer ${secret}` };
  const res = await fetch(`${OPENAI_API_BASE_URL}/videos/${encodeURIComponent(taskId)}`, { headers });
  if (!res.ok) {
    if (res.status === 404) return { status: "failed", message: `OpenAI video job ${taskId} not found` };
    return { status: "processing" };
  }
  const job = (await res.json()) as SoraJob;
  if (job.status === "failed") {
    return { status: "failed", message: job.error?.message ?? "OpenAI reported the video as failed" };
  }
  if (job.status !== "completed") return { status: "processing" };

  const content = await fetch(`${OPENAI_API_BASE_URL}/videos/${encodeURIComponent(taskId)}/content`, {
    headers,
  });
  if (!content.ok) {
    return { status: "failed", message: `OpenAI video download failed: ${await readError(content)}` };
  }
  const contentType = content.headers.get("content-type") ?? "video/mp4";
  return {
    status: "completed",
    assets: [
      {
        kind: "bytes",
        bytes: Buffer.from(await content.arrayBuffer()),
        contentType,
        ext: extensionForContentType(contentType) === "bin" ? "mp4" : extensionForContentType(contentType),
      },
    ],
  };
}

async function checkKey(secret: string): Promise<ProviderKeyCheck> {
  const res = await fetch(`${OPENAI_API_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, body: await readError(res) };
}

export const openaiProvider: Provider = {
  info: {
    id: "openai",
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    envVarName: "OPENAI_API_KEY",
  },
  editingModel: "openai/gpt-image-1",
  createImageTask,
  async fetchImageTask(model) {
    // Image generation is synchronous; nothing is ever pending.
    throw new UnknownModelError(`${model} (OpenAI images do not create asynchronous tasks)`);
  },
  parseImageCallback() {
    throw new UnsupportedCallbackError("openai");
  },
  createVideoTask,
  fetchVideoTask,
  parseVideoCallback() {
    throw new UnsupportedCallbackError("openai");
  },
  checkKey,
};
