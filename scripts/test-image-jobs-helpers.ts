import { test } from "node:test";
import assert from "node:assert/strict";

import { mapProviderStatusToJobStatus } from "../src/lib/image-jobs.ts";

test("nano-banana-2 success state maps to completed", () => {
  assert.equal(
    mapProviderStatusToJobStatus("kie/nano-banana-2", "success"),
    "completed",
  );
});

test("4o-image successFlag=1 maps to completed", () => {
  assert.equal(mapProviderStatusToJobStatus("kie/4o-image", 1), "completed");
});

test("fail states map to failed", () => {
  assert.equal(mapProviderStatusToJobStatus("kie/nano-banana-2", "fail"), "failed");
  assert.equal(mapProviderStatusToJobStatus("kie/4o-image", 2), "failed");
});

test("unknown / in-flight states map to processing", () => {
  assert.equal(mapProviderStatusToJobStatus("kie/4o-image", undefined), "processing");
  assert.equal(mapProviderStatusToJobStatus("kie/4o-image", "queued"), "processing");
});
