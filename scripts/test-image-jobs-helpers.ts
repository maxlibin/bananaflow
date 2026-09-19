import { test } from "node:test";
import assert from "node:assert/strict";

import { imageStatusFromPayload } from "../src/lib/providers/kie.ts";

test("Kie 4o-image successFlag=1 with URLs maps to completed", () => {
  const status = imageStatusFromPayload("kie/4o-image", {
    data: { successFlag: 1, result_urls: ["https://cdn.example/a.png"] },
  });
  assert.equal(status.status, "completed");
  if (status.status === "completed") {
    assert.deepEqual(status.assets, [{ kind: "url", url: "https://cdn.example/a.png" }]);
  }
});

test("Kie nano-banana-2 success without URLs is a failure, not processing", () => {
  const status = imageStatusFromPayload("kie/nano-banana-2", { data: { state: "success" } });
  assert.equal(status.status, "failed");
});

test("Kie fail states map to failed with the provider message", () => {
  const status = imageStatusFromPayload("kie/4o-image", {
    data: { successFlag: 2, errorMessage: "content policy" },
  });
  assert.equal(status.status, "failed");
});

test("Kie in-flight states map to processing", () => {
  assert.equal(imageStatusFromPayload("kie/4o-image", { data: { successFlag: 0 } }).status, "processing");
  assert.equal(imageStatusFromPayload("kie/nano-banana-2", { data: { state: "queued" } }).status, "processing");
});
