import { waitWithAbort } from "./generation-utils";
import { materializeAssets, type MaterializedAsset } from "./generated-assets";
import type { ImageTaskInput, Provider } from "./providers/types";

export class ImageTaskFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageTaskFailedError";
  }
}

// Runs one image task end to end, hiding the sync/async difference between
// providers: synchronous results return at once, asynchronous tasks are
// polled until they settle or the attempt budget runs out.
export async function runImageTaskToCompletion(input: {
  provider: Provider;
  task: ImageTaskInput;
  pollIntervalMs: number;
  maxPolls: number;
}): Promise<MaterializedAsset[]> {
  const started = await input.provider.createImageTask(input.task);
  if (!started.ok) throw new ImageTaskFailedError(started.message);
  if (started.mode === "sync") {
    return materializeAssets(started.assets, input.task.signal);
  }

  for (let attempt = 0; attempt < input.maxPolls; attempt++) {
    await waitWithAbort(input.pollIntervalMs, input.task.signal);
    const status = await input.provider.fetchImageTask(
      input.task.model,
      started.taskId,
      input.task.secret,
    );
    if (status.status === "failed") throw new ImageTaskFailedError(status.message);
    if (status.status === "completed") {
      return materializeAssets(status.assets, input.task.signal);
    }
  }
  throw new ImageTaskFailedError(
    `Provider task ${started.taskId} did not finish within ${Math.round((input.maxPolls * input.pollIntervalMs) / 1000)}s`,
  );
}
