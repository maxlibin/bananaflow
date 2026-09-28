import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_VIDEO_MODEL_SETTINGS } from "../src/lib/video-models.ts";
import {
  InvalidVideoInputError,
  InvalidVideoSettingsError,
  checkLastFrame,
  resolveVideoSettings,
  resolveVideoShots,
} from "../src/lib/video-settings.ts";

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

const MULTI = {
  supportsLastFrame: true,
  multiShot: { maxShots: 3, shotSeconds: [1, 6] as [number, number], totalSeconds: [3, 10] as [number, number], promptChars: 20 },
};

test("multi-shot clips must fit the model's shot and total limits", () => {
  assert.equal(resolveVideoShots("m", MULTI, undefined), null);
  assert.deepEqual(
    resolveVideoShots("m", MULTI, [{ prompt: " open ", seconds: 2 }, { prompt: "close", seconds: 3 }]),
    [{ prompt: "open", seconds: 2 }, { prompt: "close", seconds: 3 }],
  );
  const rejected: unknown[] = [
    [{ prompt: "only one", seconds: 3 }],
    [{ prompt: "a", seconds: 1 }, { prompt: "b", seconds: 1 }],
    [{ prompt: "a", seconds: 6 }, { prompt: "b", seconds: 6 }],
    [{ prompt: "a", seconds: 2.5 }, { prompt: "b", seconds: 2 }],
    [{ prompt: "", seconds: 2 }, { prompt: "b", seconds: 2 }],
    [{ prompt: "x".repeat(21), seconds: 2 }, { prompt: "b", seconds: 2 }],
    "not a list",
  ];
  for (const shots of rejected) {
    assert.throws(() => resolveVideoShots("m", MULTI, shots), InvalidVideoInputError, JSON.stringify(shots));
  }
  assert.throws(
    () => resolveVideoShots("m", LISTED, [{ prompt: "a", seconds: 2 }, { prompt: "b", seconds: 2 }]),
    InvalidVideoInputError,
  );
});

test("a last frame needs a supporting model, one first frame and no shots", () => {
  checkLastFrame("m", MULTI, { firstFrames: 1, shots: null });
  assert.throws(() => checkLastFrame("m", LISTED, { firstFrames: 1, shots: null }), InvalidVideoInputError);
  assert.throws(() => checkLastFrame("m", MULTI, { firstFrames: 0, shots: null }), InvalidVideoInputError);
  assert.throws(() => checkLastFrame("m", MULTI, { firstFrames: 2, shots: null }), InvalidVideoInputError);
  assert.throws(
    () => checkLastFrame("m", MULTI, { firstFrames: 1, shots: [{ prompt: "a", seconds: 2 }] }),
    InvalidVideoInputError,
  );
});
