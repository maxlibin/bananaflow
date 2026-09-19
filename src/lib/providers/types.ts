import type { VideoModelSettings } from "../video-models";

// Providers are supplied by the host (see HostAdapter.providers), so the id
// space is open: the built-in adapters use "openai" and "google", and a
// hosted deployment can register its own.
export type ProviderId = string;

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  // Where a user obtains a key.
  keyUrl: string;
  // Environment variable that can supply a server-wide key.
  envVarName: string;
};

// A finished asset: either a URL the engine downloads, or bytes the adapter
// already holds (providers that return base64 or require an authenticated
// download).
export type GeneratedAsset =
  | { kind: "url"; url: string }
  | { kind: "bytes"; bytes: Buffer; contentType: string; ext: string };

export type TaskStart =
  | { ok: true; mode: "async"; taskId: string }
  | { ok: true; mode: "sync"; assets: GeneratedAsset[] }
  | { ok: false; status: number; message: string };

export type TaskStatus =
  | { status: "processing" }
  | { status: "completed"; assets: GeneratedAsset[] }
  | { status: "failed"; message: string };

// A reference image supplied by the user. `publicUrl` is what URL-taking
// providers receive; `fetchBytes` serves providers that take inline data.
export type ReferenceImage = {
  publicUrl: string;
  fetchBytes: () => Promise<{ bytes: Buffer; contentType: string }>;
};

export type ImageTaskInput = {
  model: string;
  providerModel: string;
  prompt: string;
  referenceImages: ReferenceImage[];
  settings: Record<string, unknown>;
  variants: number;
  callBackUrl: string | null;
  secret: string;
  signal: AbortSignal;
};

export type VideoTaskInput = {
  model: string;
  providerModel: string;
  prompt: string;
  referenceImages: ReferenceImage[];
  settings: Partial<VideoModelSettings>;
  callBackUrl: string | null;
  secret: string;
};

export type ProviderKeyCheck =
  | { ok: true }
  // `status` is the provider's own error code when it returns one in the
  // body, otherwise the HTTP status; `body` is the provider's message.
  | { ok: false; status: number; body: string };

export type Provider = {
  info: ProviderInfo;
  // Model key (e.g. "google/gemini-2.5-flash-image") used for upscale,
  // background removal and face consistency, or null if the provider has no
  // editing-capable image model.
  editingModel: string | null;
  createImageTask(input: ImageTaskInput): Promise<TaskStart>;
  fetchImageTask(model: string, taskId: string, secret: string): Promise<TaskStatus>;
  parseImageCallback(model: string, payload: Record<string, unknown>): TaskStatus;
  createVideoTask(input: VideoTaskInput): Promise<TaskStart>;
  fetchVideoTask(model: string, taskId: string, secret: string): Promise<TaskStatus>;
  parseVideoCallback(model: string, payload: Record<string, unknown>): TaskStatus;
  checkKey(secret: string): Promise<ProviderKeyCheck>;
};

export class UnsupportedCallbackError extends Error {
  constructor(provider: ProviderId) {
    super(`Provider "${provider}" does not send webhooks; jobs are finalized by polling.`);
    this.name = "UnsupportedCallbackError";
  }
}

export class UnknownModelError extends Error {
  constructor(model: string) {
    super(`Unknown model "${model}"`);
    this.name = "UnknownModelError";
  }
}

export class UnknownProviderError extends Error {
  constructor(id: ProviderId) {
    super(`No provider registered for "${id}"`);
    this.name = "UnknownProviderError";
  }
}

export function providerOfModel(model: string): ProviderId {
  return model.split("/")[0];
}

export function extensionForContentType(contentType: string): string {
  const subtype = contentType.split(";")[0].split("/")[1] ?? "";
  if (subtype === "jpeg" || subtype === "jpg") return "jpg";
  if (subtype === "quicktime") return "mov";
  return subtype || "bin";
}
