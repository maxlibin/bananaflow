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
