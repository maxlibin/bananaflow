import { ProviderKeyMissingError } from "../host/errors";
import type { HostAdapter } from "../host/types";
import { applyImageTaskStatus, findStaleImageJobs } from "../image-jobs";
import { getProvider } from "../providers";

export type PollSummary = {
  scanned: number;
  completed: number;
  failed: number;
  stillProcessing: number;
  skipped: number;
};

const STALE_AFTER_SECONDS = 30;

// Safety net for dropped or unreachable webhooks: re-checks every job that
// has not been touched for 30s directly against its provider.
export async function pollImageJobs(host: HostAdapter): Promise<PollSummary> {
  const stale = await findStaleImageJobs(host.db, STALE_AFTER_SECONDS);

  let completed = 0;
  let failed = 0;
  let stillProcessing = 0;
  let skipped = 0;

  for (const job of stale) {
    const info = host.models.image[job.model];
    if (!job.providerTaskId || !info) {
      skipped += 1;
      continue;
    }
    let providerSecret: string;
    try {
      providerSecret = await host.keys.resolveProviderKey(job.userId, info.provider);
    } catch (error) {
      if (!(error instanceof ProviderKeyMissingError)) throw error;
      console.error("[scheduler][poll-image-jobs] provider key missing", {
        jobId: job.id,
        userId: job.userId,
        provider: info.provider,
        message: error.message,
      });
      skipped += 1;
      continue;
    }
    try {
      const status = await getProvider(host, info.provider).fetchImageTask(
        job.model,
        job.providerTaskId,
        providerSecret,
      );
      const outcome = await applyImageTaskStatus(host, job, status);
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
