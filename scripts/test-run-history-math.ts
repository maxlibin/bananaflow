import { test } from "node:test";
import assert from "node:assert/strict";

import {
  VARIATION_CAPS,
  clampVariantCount,
} from "../src/lib/run-history-math";

test("image variants cap at 6", () => {
  assert.equal(clampVariantCount("image", 100), 6);
  assert.equal(clampVariantCount("image", 6), 6);
  assert.equal(clampVariantCount("image", 4), 4);
});

test("video variants cap at 2", () => {
  assert.equal(clampVariantCount("video", 100), 2);
  assert.equal(clampVariantCount("video", 2), 2);
  assert.equal(clampVariantCount("video", 1), 1);
});

test("clampVariantCount floors below 1 → 1", () => {
  assert.equal(clampVariantCount("image", 0), 1);
  assert.equal(clampVariantCount("image", -5), 1);
  assert.equal(clampVariantCount("video", 0), 1);
});

test("clampVariantCount floors fractional input", () => {
  assert.equal(clampVariantCount("image", 3.7), 3);
  assert.equal(clampVariantCount("video", 1.9), 1);
});

test("VARIATION_CAPS is the source of truth", () => {
  assert.equal(VARIATION_CAPS.image, 6);
  assert.equal(VARIATION_CAPS.video, 2);
  // If these change, every UI component referencing variant counts must
  // be updated. The test exists to make that change visible in code review.
});
