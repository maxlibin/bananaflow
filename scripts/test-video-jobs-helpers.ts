import { test } from "node:test";
import assert from "node:assert/strict";

import { mapProviderStatusToJobStatus } from "../src/lib/video-jobs.ts";

test("maps Kie success states to completed", () => {
  assert.equal(mapProviderStatusToJobStatus("kie/runway", "success"), "completed");
  assert.equal(mapProviderStatusToJobStatus("kie/veo3", 1), "completed");
});

test("maps Kie fail states to failed", () => {
  assert.equal(mapProviderStatusToJobStatus("kie/runway", "fail"), "failed");
  assert.equal(mapProviderStatusToJobStatus("kie/veo3", 2), "failed");
  assert.equal(mapProviderStatusToJobStatus("kie/veo3", 3), "failed");
});

test("maps unknown/in-flight states to processing", () => {
  assert.equal(
    mapProviderStatusToJobStatus("kie/runway", "queued"),
    "processing",
  );
  assert.equal(
    mapProviderStatusToJobStatus("kie/runway", "generating"),
    "processing",
  );
  assert.equal(mapProviderStatusToJobStatus("kie/runway", undefined), "processing");
});
