import { ProviderKeyMissingError } from "../host/errors";
import type { HostAdapter } from "../host/types";
import type { PollSummary } from "./poll-image-jobs";
import {
  fetchProviderTaskStatus,
  type VideoModelKey,
} from "../video-generation-service";
import {
  finalizeVideoJobFromProviderPayload,
  findStaleVideoJobs,
} from "../video-jobs";

const STALE_AFTER_SECONDS = 30;

export async function pollVideoJobs(host: HostAdapter): Promise<PollSummary> {
  const stale = await findStaleVideoJobs(host.db, STALE_AFTER_SECONDS);

  let completed = 0;
  let failed = 0;
  let stillProcessing = 0;
  let skipped = 0;

  for (const job of stale) {
    if (!job.providerTaskId) {
      // Never made it to the provider — webhook can't help; mark and move on.
      skipped += 1;
      continue;
    }
    let providerSecret: string;
    try {
      providerSecret = await host.keys.resolveProviderKey(job.userId, "kie");
    } catch (error) {
      if (!(error instanceof ProviderKeyMissingError)) throw error;
      console.error("[scheduler][poll-video-jobs] provider key missing", {
        jobId: job.id,
        userId: job.userId,
        message: error.message,
      });
      skipped += 1;
      continue;
    }
    const model = job.model as VideoModelKey;
    const result = await fetchProviderTaskStatus(model, job.providerTaskId, providerSecret);
    if (!result.ok) {
      stillProcessing += 1;
      continue;
    }
    try {
      const outcome = await finalizeVideoJobFromProviderPayload(host, job, result.payload);
      if (outcome.status === "completed") completed += 1;
      else if (outcome.status === "failed") failed += 1;
      else stillProcessing += 1;
    } catch (err) {
      console.error("[scheduler][poll-video-jobs] finalize error", { jobId: job.id, err });
      stillProcessing += 1;
    }
  }

  return { scanned: stale.length, completed, failed, stillProcessing, skipped };
}
