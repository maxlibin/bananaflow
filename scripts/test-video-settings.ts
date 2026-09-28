import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_VIDEO_MODEL_SETTINGS } from "../src/lib/video-models.ts";
import { InvalidVideoSettingsError, resolveVideoSettings } from "../src/lib/video-settings.ts";

const LISTED = { durations: ["5", "10"], resolutions: ["720p", "1080p"], sounds: [true, false] };
const RANGED = { durationRange: [4, 15] as [number, number], generateAudioOptions: [false, true] };

test("keeps only the fields the model offers", () => {
  const resolved = resolveVideoSettings("m", LISTED, { ...DEFAULT_VIDEO_MODEL_SETTINGS, duration: "10" });
  assert.deepEqual(resolved, { duration: "10", resolution: "720p", sound: false });
});

test("a missing offered field takes the model's first option", () => {
  assert.deepEqual(resolveVideoSettings("m", LISTED, {}), { duration: "5", resolution: "720p", sound: true });
  assert.deepEqual(resolveVideoSettings("m", RANGED, {}), { duration: "4", generateAudio: false });
});

test("rejects values the model does not offer", () => {
  assert.throws(() => resolveVideoSettings("m", LISTED, { duration: "1" }), InvalidVideoSettingsError);
  assert.throws(() => resolveVideoSettings("m", LISTED, { resolution: "4K" }), InvalidVideoSettingsError);
  // A number is not the string the provider request is built from.
  assert.throws(
    () => resolveVideoSettings("m", LISTED, { duration: 10 as unknown as string }),
    InvalidVideoSettingsError,
  );
});

test("a duration range accepts whole seconds inside it only", () => {
  assert.equal(resolveVideoSettings("m", RANGED, { duration: "15" }).duration, "15");
  for (const duration of ["3", "16", "4.5", "", 8 as unknown as string]) {
    assert.throws(() => resolveVideoSettings("m", RANGED, { duration }), InvalidVideoSettingsError);
  }
});
