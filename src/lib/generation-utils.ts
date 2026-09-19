export function createDebugLogger(enabled: boolean) {
  const debugLog = (message: string, data?: Record<string, unknown>) => {
    if (!enabled) {
      return;
    }
    console.log(message, data ?? {});
  };

  const debugWarn = (message: string, data?: Record<string, unknown>) => {
    if (!enabled) {
      return;
    }
    console.warn(message, data ?? {});
  };

  return { debugLog, debugWarn };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function createAbortError(): Error {
  const error = new Error("Generation canceled");
  error.name = "AbortError";
  return error;
}

export async function waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw createAbortError();
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(createAbortError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function parseJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function findFirstUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.startsWith("http://") || value.startsWith("https://")
      ? value
      : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUrl(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const prioritizedKeys = [
    "result_urls",
    "resultUrls",
    "resultImageUrl",
    "image_url",
    "imageUrl",
    "url",
    "resultUrl",
  ];

  for (const key of prioritizedKeys) {
    const found = findFirstUrl(record[key]);
    if (found) {
      return found;
    }
  }

  for (const entry of Object.values(record)) {
    const found = findFirstUrl(entry);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export function findAllUrls(value: unknown): string[] {
  const urls = new Set<string>();

  const walk = (current: unknown) => {
    if (typeof current === "string") {
      if (current.startsWith("http://") || current.startsWith("https://")) {
        urls.add(current);
      }
      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        walk(item);
      }
      return;
    }

    if (!current || typeof current !== "object") {
      return;
    }

    for (const nested of Object.values(current as Record<string, unknown>)) {
      walk(nested);
    }
  };

  walk(value);
  return Array.from(urls);
}

export function findTaskId(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const parsed = parseJsonObject(value);
    if (parsed) {
      return findTaskId(parsed);
    }

    const trimmed = value.trim();
    if (trimmed.length >= 8 && !trimmed.includes(" ")) {
      return trimmed;
    }
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTaskId(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const prioritizedKeys = [
    "taskId",
    "task_id",
    "jobId",
    "job_id",
    "recordId",
    "record_id",
    "id",
    "requestId",
    "request_id",
  ];

  for (const key of prioritizedKeys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim().length >= 6) {
      return direct.trim();
    }
  }

  for (const [key, nested] of Object.entries(record)) {
    const isLikelyTaskKey =
      key.toLowerCase().includes("task") ||
      key.toLowerCase().includes("job") ||
      key.toLowerCase().includes("record");
    if (isLikelyTaskKey && typeof nested === "string" && nested.trim().length >= 6) {
      return nested.trim();
    }
  }

  for (const nested of Object.values(record)) {
    const found = findTaskId(nested);
    if (found) {
      return found;
    }
  }

  return undefined;
}
