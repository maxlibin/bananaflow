import type { VideoModelSettings } from "../video-models";

export type ProviderId = "openai" | "google" | "kie";

export const PROVIDER_IDS: readonly ProviderId[] = ["openai", "google", "kie"];

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  // Where a user obtains a key.
  keyUrl: string;
  // Environment variable that can supply a server-wide key.
  envVarName: string;
};

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    envVarName: "OPENAI_API_KEY",
  },
  google: {
    id: "google",
    label: "Google AI Studio",
    keyUrl: "https://aistudio.google.com/apikey",
    envVarName: "GOOGLE_API_KEY",
  },
  kie: {
    id: "kie",
    label: "Kie.ai",
    keyUrl: "https://kie.ai/api-key",
    envVarName: "KIE_SECRET",
  },
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
  id: ProviderId;
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

export function providerOfModel(model: string): ProviderId | null {
  const prefix = model.split("/")[0];
  return (PROVIDER_IDS as readonly string[]).includes(prefix) ? (prefix as ProviderId) : null;
}

export function extensionForContentType(contentType: string): string {
  const subtype = contentType.split(";")[0].split("/")[1] ?? "";
  if (subtype === "jpeg" || subtype === "jpg") return "jpg";
  if (subtype === "quicktime") return "mov";
  return subtype || "bin";
}
