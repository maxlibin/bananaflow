import type { VideoSettingOptions } from "./model-options";
import type { VideoModelSettings } from "./video-models";

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
