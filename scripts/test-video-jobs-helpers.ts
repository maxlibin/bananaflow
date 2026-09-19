import { test } from "node:test";
import assert from "node:assert/strict";

import { videoStatusFromPayload } from "../src/lib/providers/kie.ts";

test("Kie runway success with a URL maps to completed", () => {
  const status = videoStatusFromPayload("kie/runway", {
    data: { state: "success", url: "https://cdn.example/a.mp4" },
  });
  assert.equal(status.status, "completed");
  if (status.status === "completed") {
    assert.deepEqual(status.assets, [{ kind: "url", url: "https://cdn.example/a.mp4" }]);
  }
});

test("Kie fail states map to failed", () => {
  assert.equal(videoStatusFromPayload("kie/runway", { data: { state: "fail" } }).status, "failed");
  assert.equal(videoStatusFromPayload("kie/veo3", { data: { successFlag: 2 } }).status, "failed");
});

test("Kie in-flight states map to processing", () => {
  assert.equal(videoStatusFromPayload("kie/runway", { data: { state: "queued" } }).status, "processing");
  assert.equal(videoStatusFromPayload("kie/runway", { data: {} }).status, "processing");
});

test("webhook payload with a URL but no state counts as completed", () => {
  const status = videoStatusFromPayload("kie/runway", {
    code: 200,
    data: { url: "https://cdn.example/b.mp4" },
  });
  assert.equal(status.status, "completed");
});
