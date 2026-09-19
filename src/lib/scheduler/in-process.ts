import { host } from "../../host";
import { pollImageJobs } from "./poll-image-jobs";
import { pollVideoJobs } from "./poll-video-jobs";
import { processBulk } from "./process-bulk";

const POLL_INTERVAL_MS = 15_000;
const BULK_INTERVAL_MS = 10_000;

declare global {
  var __bananaflowSchedulerStarted: boolean | undefined;
}

function every(name: string, intervalMs: number, work: () => Promise<unknown>) {
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    work()
      .catch((error) => {
        console.error("[scheduler] tick failed", { task: name, error });
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs).unref();
}

// Guarded on globalThis so dev-mode hot reloads do not stack intervals.
export function startInProcessScheduler(): void {
  if (globalThis.__bananaflowSchedulerStarted) return;
  globalThis.__bananaflowSchedulerStarted = true;
  every("poll-image-jobs", POLL_INTERVAL_MS, () => pollImageJobs(host));
  every("poll-video-jobs", POLL_INTERVAL_MS, () => pollVideoJobs(host));
  every("process-bulk", BULK_INTERVAL_MS, () => processBulk(host, new AbortController().signal));
  console.log("[scheduler] in-process scheduler started", {
    pollIntervalMs: POLL_INTERVAL_MS,
    bulkIntervalMs: BULK_INTERVAL_MS,
  });
}
