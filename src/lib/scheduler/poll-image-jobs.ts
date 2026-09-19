import { ProviderKeyMissingError } from "../host/errors";
import type { HostAdapter } from "../host/types";
import {
  fetchImageProviderTaskStatus,
  type ImageModelKey,
} from "../image-generation-service";
import {
  finalizeImageJobFromProviderPayload,
  findStaleImageJobs,
} from "../image-jobs";

export type PollSummary = {
  scanned: number;
  completed: number;
  failed: number;
  stillProcessing: number;
  skipped: number;
};

const STALE_AFTER_SECONDS = 30;

// Safety net for dropped or unreachable webhooks: re-checks every job that
// has not been touched for 30s directly against the provider.
export async function pollImageJobs(host: HostAdapter): Promise<PollSummary> {
  const stale = await findStaleImageJobs(host.db, STALE_AFTER_SECONDS);

  let completed = 0;
  let failed = 0;
  let stillProcessing = 0;
  let skipped = 0;

  for (const job of stale) {
    if (!job.providerTaskId) {
      skipped += 1;
      continue;
    }
    let providerSecret: string;
    try {
      providerSecret = await host.keys.resolveProviderKey(job.userId, "kie");
    } catch (error) {
      if (!(error instanceof ProviderKeyMissingError)) throw error;
      console.error("[scheduler][poll-image-jobs] provider key missing", {
        jobId: job.id,
        userId: job.userId,
        message: error.message,
      });
      skipped += 1;
      continue;
    }
    const model = job.model as ImageModelKey;
    const result = await fetchImageProviderTaskStatus(
      model,
      job.providerTaskId,
      providerSecret,
    );
    if (!result.ok) {
      stillProcessing += 1;
      continue;
    }
    try {
      const outcome = await finalizeImageJobFromProviderPayload(host, job, result.payload);
      if (outcome.status === "completed") completed += 1;
      else if (outcome.status === "failed") failed += 1;
      else stillProcessing += 1;
    } catch (err) {
      console.error("[scheduler][poll-image-jobs] finalize error", { jobId: job.id, err });
      stillProcessing += 1;
    }
  }

  return { scanned: stale.length, completed, failed, stillProcessing, skipped };
}
