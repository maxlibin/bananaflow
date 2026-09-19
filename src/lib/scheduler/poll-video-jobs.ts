import { ProviderKeyMissingError } from "../host/errors";
import type { HostAdapter } from "../host/types";
import { getProvider } from "../providers";
import { applyVideoTaskStatus, findStaleVideoJobs } from "../video-jobs";
import type { PollSummary } from "./poll-image-jobs";

const STALE_AFTER_SECONDS = 30;

export async function pollVideoJobs(host: HostAdapter): Promise<PollSummary> {
  const stale = await findStaleVideoJobs(host.db, STALE_AFTER_SECONDS);

  let completed = 0;
  let failed = 0;
  let stillProcessing = 0;
  let skipped = 0;

  for (const job of stale) {
    const info = host.models.video[job.model];
    if (!job.providerTaskId || !info) {
      // Never made it to the provider — webhook can't help; mark and move on.
      skipped += 1;
      continue;
    }
    let providerSecret: string;
    try {
      providerSecret = await host.keys.resolveProviderKey(job.userId, info.provider);
    } catch (error) {
      if (!(error instanceof ProviderKeyMissingError)) throw error;
      console.error("[scheduler][poll-video-jobs] provider key missing", {
        jobId: job.id,
        userId: job.userId,
        provider: info.provider,
        message: error.message,
      });
      skipped += 1;
      continue;
    }
    try {
      const status = await getProvider(host, info.provider).fetchVideoTask(
        job.model,
        job.providerTaskId,
        providerSecret,
      );
      const outcome = await applyVideoTaskStatus(host, job, status);
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
