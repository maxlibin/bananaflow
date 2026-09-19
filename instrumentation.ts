// Runs once per server start (Next.js instrumentation hook). When
// ENABLE_INPROCESS_SCHEDULER is "true" the app drives the job pollers and
// the bulk queue itself, so a self-hosted deployment needs no external cron.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_INPROCESS_SCHEDULER !== "true") return;

  const { startInProcessScheduler } = await import("./src/lib/scheduler/in-process");
  startInProcessScheduler();
}
