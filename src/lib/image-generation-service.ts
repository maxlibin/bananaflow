import { KIE_IMAGE_MODELS, type ImageModelConfig } from "./image-models";
import {
  findAllUrls,
  findFirstUrl,
  findTaskId,
  parseJsonObject,
} from "./generation-utils";
import { buildProviderUrl } from "./provider-api";

export { KIE_IMAGE_MODELS };
export type KieImageModelKey = keyof typeof KIE_IMAGE_MODELS;

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
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      const v = c.trim();
      if (normalizeStateValue(v) === "success") continue;
      return v;
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

export function resolveImageTaskId(
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

export function extractGeneratedImageUrls(
  statusResult: Record<string, unknown>,
  modelConfig: Pick<ImageModelConfig, "imageUrlField">
): string[] {
  const data = (statusResult.data || statusResult) as Record<string, unknown>;
  const output = data.output as Record<string, unknown> | undefined;
  const result = data.result as Record<string, unknown> | undefined;
  const info = data.info as Record<string, unknown> | undefined;
  const statusData = statusResult.data as Record<string, unknown> | undefined;
  const parsedResultJson =
    parseJsonObject(data.resultJson) ||
    parseJsonObject(statusData?.resultJson) ||
    parseJsonObject(statusResult.resultJson);
  const responsePayload =
    parseJsonObject(data.response) ||
    parseJsonObject(statusData?.response) ||
    parseJsonObject(parsedResultJson?.response);

  const resultUrls =
    data.result_urls ||
    data.resultUrls ||
    info?.result_urls ||
    info?.resultUrls ||
    statusData?.result_urls ||
    statusData?.resultUrls ||
    responsePayload?.result_urls ||
    responsePayload?.resultUrls ||
    parsedResultJson?.result_urls ||
    parsedResultJson?.resultUrls;

  const directUrls = Array.isArray(resultUrls)
    ? resultUrls.filter((url): url is string => typeof url === "string")
    : [];

  const extractedUrls = findAllUrls({
    modelField: data[modelConfig.imageUrlField],
    topLevelField: statusResult[modelConfig.imageUrlField],
    resultImageUrl: data.resultImageUrl,
    url: data.url,
    imageUrl: data.imageUrl,
    image_url: data.image_url,
    info,
    output,
    result,
    responsePayload,
    rawResponse: data.response,
    parsedResultJson,
  });

  const fallbackUrl = findFirstUrl({
    modelField: data[modelConfig.imageUrlField],
    topLevelField: statusResult[modelConfig.imageUrlField],
    resultImageUrl: data.resultImageUrl,
    url: data.url,
    imageUrl: data.imageUrl,
    image_url: data.image_url,
    info,
    output,
    result,
    responsePayload,
    rawResponse: data.response,
    parsedResultJson,
  });

  return Array.from(
    new Set([
      ...directUrls,
      ...extractedUrls,
      ...(fallbackUrl ? [fallbackUrl] : []),
    ])
  );
}

export type DownloadedImage = {
  buffer: ArrayBuffer;
  contentType: string;
  ext: string;
  sourceUrl: string;
};

export async function downloadGeneratedImages(
  generatedImageUrls: string[],
  signal: AbortSignal,
  options?: {
    onDownloadError?: (error: { url: string; status: number }) => void;
  }
): Promise<DownloadedImage[]> {
  const downloadedImages: DownloadedImage[] = [];

  for (const generatedImageUrl of generatedImageUrls) {
    const imageResponse = await fetch(generatedImageUrl, { signal });
    if (!imageResponse.ok) {
      options?.onDownloadError?.({
        url: generatedImageUrl,
        status: imageResponse.status,
      });
      continue;
    }

    const buffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/png";
    const ext = contentType.split("/")[1] || "png";

    downloadedImages.push({
      buffer,
      contentType,
      ext,
      sourceUrl: generatedImageUrl,
    });
  }

  return downloadedImages;
}

export interface CreateImageProviderTaskInput {
  model: KieImageModelKey;
  prompt: string;
  imageUrls: string[];
  settings: Record<string, unknown>;
  // null when the host has no public origin; the poller finalizes the job.
  callBackUrl: string | null;
  providerSecret: string;
}

export async function createImageProviderTask(
  input: CreateImageProviderTaskInput,
): Promise<
  | { ok: true; taskId: string }
  | { ok: false; status: number; message: string }
> {
  const config = KIE_IMAGE_MODELS[input.model];
  const settings = input.settings as Record<string, string | undefined>;
  const body = config.buildBody(input.prompt, {
    aspectRatio: typeof settings.aspectRatio === "string" ? settings.aspectRatio : undefined,
    imageUrls: input.imageUrls.length > 0 ? input.imageUrls : undefined,
    imageSize: typeof settings.imageSize === "string" ? settings.imageSize : undefined,
    imageResolution:
      typeof settings.imageResolution === "string" ? settings.imageResolution : undefined,
    quality: typeof settings.quality === "string" ? settings.quality : undefined,
    style: typeof settings.style === "string" ? settings.style : undefined,
  });
  const bodyWithCallback =
    input.callBackUrl === null ? body : { ...body, callBackUrl: input.callBackUrl };

  let res: Response;
  try {
    res = await fetch(buildProviderUrl(config.endpoint), {
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
  const taskId = resolveImageTaskId(parsed, config.taskIdField);
  if (!taskId) {
    return { ok: false, status: 502, message: "Provider response missing taskId" };
  }
  return { ok: true, taskId };
}

export async function fetchImageProviderTaskStatus(
  model: KieImageModelKey,
  taskId: string,
  providerSecret: string,
): Promise<
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; status: number; message: string }
> {
  const config = KIE_IMAGE_MODELS[model];
  const url = `${buildProviderUrl(config.statusEndpoint)}?taskId=${encodeURIComponent(taskId)}`;
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
