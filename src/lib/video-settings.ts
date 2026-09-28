import type { VideoSettingOptions } from "./model-options";
import type { VideoModelSettings, VideoShot } from "./video-models";

export class InvalidVideoSettingsError extends Error {
  constructor(
    readonly model: string,
    readonly field: keyof VideoModelSettings,
    readonly value: unknown,
    readonly allowed: string,
  ) {
    super(`${field} ${JSON.stringify(value)} is not available for ${model}; allowed: ${allowed}`);
    this.name = "InvalidVideoSettingsError";
  }
}

// A request whose inputs the model cannot take (shots, frames).
export class InvalidVideoInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidVideoInputError";
  }
}

type ListField = {
  [K in keyof VideoSettingOptions]-?: NonNullable<VideoSettingOptions[K]> extends Array<string | boolean>
    ? K
    : never;
}[keyof VideoSettingOptions];

const LIST_FIELDS: Array<[ListField, keyof VideoModelSettings]> = [
  ["durations", "duration"],
  ["nFrames", "nFrames"],
  ["aspectRatios", "aspectRatio"],
  ["modes", "mode"],
  ["sounds", "sound"],
  ["resolutions", "resolution"],
  ["sizes", "size"],
  ["qualities", "quality"],
  ["promptOptimizers", "promptOptimizer"],
  ["fixedLensOptions", "fixedLens"],
  ["generateAudioOptions", "generateAudio"],
  ["removeWatermarkOptions", "removeWatermark"],
];

/**
 * Keeps only the settings the model offers and checks each against its
 * allowed values, so the provider request and the price are built from the
 * same values. The video node sends every field, including ones the chosen
 * model ignores, so unoffered fields are dropped rather than rejected. A
 * missing offered field takes the model's first option, as the node does.
 */
export function resolveVideoSettings(
  model: string,
  options: VideoSettingOptions,
  settings: Partial<VideoModelSettings>,
): Partial<VideoModelSettings> {
  const resolved: Record<string, string | boolean> = {};

  for (const [optionKey, field] of LIST_FIELDS) {
    const allowed: Array<string | boolean> | undefined = options[optionKey];
    if (!allowed || allowed.length === 0) continue;
    if (optionKey === "durations" && options.durationRange) continue;
    const value = settings[field];
    if (value === undefined) {
      resolved[field] = allowed[0];
      continue;
    }
    if (!allowed.includes(value)) {
      throw new InvalidVideoSettingsError(model, field, value, allowed.join(", "));
    }
    resolved[field] = value;
  }

  if (options.durationRange) {
    const [min, max] = options.durationRange;
    const value = settings.duration;
    if (value === undefined) {
      resolved.duration = String(min);
    } else {
      const seconds = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
      if (!(seconds >= min && seconds <= max)) {
        throw new InvalidVideoSettingsError(model, "duration", value, `whole seconds ${min}-${max}`);
      }
      resolved.duration = value;
    }
  }

  return resolved as Partial<VideoModelSettings>;
}

/** Reads a resolved duration-like field as whole seconds. */
export function settingSeconds(
  model: string,
  field: "duration" | "nFrames",
  settings: Partial<VideoModelSettings>,
): number {
  const value = settings[field];
  const seconds = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!(seconds > 0)) {
    throw new InvalidVideoSettingsError(model, field, value, "a whole number of seconds");
  }
  return seconds;
}

/**
 * Checks a multi-shot request against the model's limits. `shots` comes
 * straight from the request body; null means a single-shot clip.
 */
export function resolveVideoShots(
  model: string,
  options: VideoSettingOptions,
  shots: unknown,
): VideoShot[] | null {
  if (shots === undefined || shots === null) return null;
  const limits = options.multiShot;
  if (!limits) throw new InvalidVideoInputError(`${model} does not support multi-shot clips`);
  if (!Array.isArray(shots) || shots.length < 2 || shots.length > limits.maxShots) {
    throw new InvalidVideoInputError(`${model} takes 2-${limits.maxShots} shots per clip`);
  }
  const [minSeconds, maxSeconds] = limits.shotSeconds;
  const resolved = shots.map((shot: unknown, index): VideoShot => {
    const { prompt, seconds } = (shot ?? {}) as { prompt?: unknown; seconds?: unknown };
    if (typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > limits.promptChars) {
      throw new InvalidVideoInputError(
        `Shot ${index + 1} needs a prompt of 1-${limits.promptChars} characters for ${model}`,
      );
    }
    if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < minSeconds || seconds > maxSeconds) {
      throw new InvalidVideoInputError(
        `Shot ${index + 1} must last ${minSeconds}-${maxSeconds} whole seconds on ${model}; got ${JSON.stringify(seconds)}`,
      );
    }
    return { prompt: prompt.trim(), seconds };
  });
  const total = resolved.reduce((sum, shot) => sum + shot.seconds, 0);
  const [minTotal, maxTotal] = limits.totalSeconds;
  if (total < minTotal || total > maxTotal) {
    throw new InvalidVideoInputError(`${model} clips last ${minTotal}-${maxTotal}s in total; these shots add up to ${total}s`);
  }
  return resolved;
}

/**
 * A last frame closes a first-and-last-frame clip, so it needs exactly one
 * first-frame image and cannot be combined with multi-shot.
 */
export function checkLastFrame(
  model: string,
  options: VideoSettingOptions,
  input: { firstFrames: number; shots: VideoShot[] | null },
): void {
  if (!options.supportsLastFrame) {
    throw new InvalidVideoInputError(`${model} cannot end on a last-frame image`);
  }
  if (input.firstFrames !== 1) {
    throw new InvalidVideoInputError(
      `A last frame needs exactly one first-frame image; ${input.firstFrames} images are connected`,
    );
  }
  if (input.shots) {
    throw new InvalidVideoInputError("A last frame cannot be combined with multi-shot");
  }
}
