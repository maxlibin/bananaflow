import { test } from "node:test";
import assert from "node:assert/strict";

import { denialActionResult, denialBody } from "../src/lib/host/denial.ts";
import type { Denial } from "../src/lib/host/types.ts";

const base: Denial = {
  ok: false,
  status: 402,
  code: null,
  message: "Insufficient credits to generate an image.",
  feature: "IMAGE_GENERATION",
  upgradeRequired: true,
  plan: null,
  retryAfterMs: null,
};

test("denialBody omits null optional fields", () => {
  assert.deepEqual(denialBody(base), {
    success: false,
    error: "Insufficient credits to generate an image.",
    upgradeRequired: true,
    feature: "IMAGE_GENERATION",
  });
});

test("denialBody includes code, plan and retryAfterMs when set", () => {
  assert.deepEqual(
    denialBody({
      ...base,
      status: 429,
      code: "RATE_LIMIT",
      plan: "FREE",
      retryAfterMs: 1200,
    }),
    {
      success: false,
      error: "Insufficient credits to generate an image.",
      upgradeRequired: true,
      feature: "IMAGE_GENERATION",
      code: "RATE_LIMIT",
      plan: "FREE",
      retryAfterMs: 1200,
    },
  );
});

test("denialActionResult matches the server-action failure shape", () => {
  assert.deepEqual(denialActionResult(base), {
    success: false,
    error: "Insufficient credits to generate an image.",
    upgradeRequired: true,
    feature: "IMAGE_GENERATION",
  });
});
