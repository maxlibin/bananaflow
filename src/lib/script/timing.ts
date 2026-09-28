import type { ScriptScene } from "./types";

export const SPOKEN_WORDS_PER_SECOND = 2.5;
export const MIN_SCENE_SECONDS = 2;

export type SceneTiming = {
  sceneId: string;
  heading: string;
  plannedSeconds: number | null;
  spokenSeconds: number;
  seconds: number;
  overPlanned: boolean;
};

export type ScriptTiming = {
  scenes: SceneTiming[];
  totalSeconds: number;
  targetSeconds: number;
  overTarget: boolean;
};

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function estimateSceneTiming(scene: ScriptScene): SceneTiming {
  const spokenWords = scene.lines
    .filter((line) => line.kind === "voiceover" || line.kind === "dialogue")
    .reduce((total, line) => total + countWords(line.text), 0);
  const spokenSeconds =
    Math.round((spokenWords / SPOKEN_WORDS_PER_SECOND) * 10) / 10;
  const seconds = Math.max(
    MIN_SCENE_SECONDS,
    spokenSeconds,
    scene.seconds ?? 0,
  );
  return {
    sceneId: scene.sceneId,
    heading: scene.heading,
    plannedSeconds: scene.seconds,
    spokenSeconds,
    seconds,
    overPlanned: scene.seconds !== null && spokenSeconds > scene.seconds,
  };
}

export function estimateScriptTiming(
  scenes: ScriptScene[],
  targetSeconds: number,
): ScriptTiming {
  const sceneTimings = scenes.map(estimateSceneTiming);
  const totalSeconds =
    Math.round(
      sceneTimings.reduce((total, scene) => total + scene.seconds, 0) * 10,
    ) / 10;
  return {
    scenes: sceneTimings,
    totalSeconds,
    targetSeconds,
    overTarget: totalSeconds > targetSeconds,
  };
}

// The shortest and longest clip a video model can make, from its setting
// options: a slider range, or a list of allowed durations.
export function clipSecondsRange(options: {
  durations?: string[];
  durationRange?: [number, number];
}): { min: number; max: number } {
  if (options.durationRange) {
    return { min: options.durationRange[0], max: options.durationRange[1] };
  }
  const durations = (options.durations ?? []).map(Number).filter(Number.isFinite);
  if (durations.length === 0) {
    throw new Error("Video model has no duration options; cannot plan shot lengths");
  }
  return { min: Math.min(...durations), max: Math.max(...durations) };
}
