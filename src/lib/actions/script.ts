import type { z } from "zod";
import type { HostAdapter } from "../host/types";
import type {
  EntityDraft,
  ScriptBrief,
  ScriptConcept,
  ScriptCritique,
  ScriptDraft,
  ShotPlan,
} from "../script/assistant";
import { generateScriptObject, type ScriptActionResult } from "../script/ai/generate";
import {
  alternativeHooksPrompt,
  breakIntoShotsPrompt,
  conceptsPrompt,
  critiquePrompt,
  editSelectionPrompt,
  extractEntitiesPrompt,
  writeScriptPrompt,
} from "../script/ai/prompts";
import {
  conceptsSchema,
  critiqueSchema,
  draftSchema,
  entitiesSchema,
  hooksSchema,
  replacementSchema,
  shotsSchema,
} from "../script/ai/schemas";

async function runScriptTask<T>(
  host: HostAdapter,
  input: {
    task: string;
    modelId: string;
    prompt: string;
    schema: z.ZodType<T>;
    maxOutputTokens: number;
  },
): Promise<ScriptActionResult<T>> {
  const userId = await host.auth.getUserId();
  if (!userId) {
    return { ok: false, error: "Sign in to use AI script writing.", denial: null };
  }
  if (!host.text.models.some((model) => model.id === input.modelId)) {
    return {
      ok: false,
      error: `Unknown writing model "${input.modelId}"; expected one of ${host.text.models.map((model) => model.id).join(", ")}`,
      denial: null,
    };
  }
  return generateScriptObject(host, { userId, ...input });
}

function mapValue<T, R>(
  result: ScriptActionResult<T>,
  map: (value: T) => R,
): ScriptActionResult<R> {
  return result.ok ? { ok: true, value: map(result.value) } : result;
}

export async function proposeScriptConcepts(
  host: HostAdapter,
  input: { brief: ScriptBrief; modelId: string },
): Promise<ScriptActionResult<ScriptConcept[]>> {
  const result = await runScriptTask(host, {
    task: "script_concepts",
    modelId: input.modelId,
    prompt: conceptsPrompt(input.brief),
    schema: conceptsSchema,
    maxOutputTokens: 2_000,
  });
  return mapValue(result, (value) => value.concepts);
}

export async function writeScript(
  host: HostAdapter,
  input: { brief: ScriptBrief; concept: ScriptConcept; modelId: string },
): Promise<ScriptActionResult<ScriptDraft>> {
  return runScriptTask(host, {
    task: "script_write",
    modelId: input.modelId,
    prompt: writeScriptPrompt(input.brief, input.concept),
    schema: draftSchema,
    maxOutputTokens: 6_000,
  });
}

export async function editScriptSelection(
  host: HostAdapter,
  input: { instruction: string; selectedText: string; scriptText: string },
): Promise<ScriptActionResult<string>> {
  const result = await runScriptTask(host, {
    task: "script_edit",
    modelId: host.text.fastModelId,
    prompt: editSelectionPrompt(input),
    schema: replacementSchema,
    maxOutputTokens: 1_000,
  });
  return mapValue(result, (value) => value.replacement);
}

export async function alternativeScriptHooks(
  host: HostAdapter,
  input: { scriptText: string; currentHook: string; count: number },
): Promise<ScriptActionResult<string[]>> {
  const result = await runScriptTask(host, {
    task: "script_hooks",
    modelId: host.text.fastModelId,
    prompt: alternativeHooksPrompt(input),
    schema: hooksSchema,
    maxOutputTokens: 1_500,
  });
  return mapValue(result, (value) => value.hooks.slice(0, input.count));
}

export async function critiqueScript(
  host: HostAdapter,
  input: { scriptText: string; targetDuration: number; platform: string; modelId: string },
): Promise<ScriptActionResult<ScriptCritique>> {
  return runScriptTask(host, {
    task: "script_critique",
    modelId: input.modelId,
    prompt: critiquePrompt(input),
    schema: critiqueSchema,
    maxOutputTokens: 3_000,
  });
}

export async function extractScriptEntities(
  host: HostAdapter,
  input: { scriptText: string; modelId: string },
): Promise<ScriptActionResult<EntityDraft[]>> {
  const result = await runScriptTask(host, {
    task: "script_entities",
    modelId: input.modelId,
    prompt: extractEntitiesPrompt(input),
    schema: entitiesSchema,
    maxOutputTokens: 2_000,
  });
  return mapValue(result, (value) => value.entities);
}

export async function breakScriptIntoShots(
  host: HostAdapter,
  input: {
    scenes: Array<{ sceneId: string; text: string; seconds: number }>;
    entities: EntityDraft[];
    aspectRatio: string;
    shotSeconds: { min: number; max: number };
    modelId: string;
  },
): Promise<ScriptActionResult<ShotPlan[]>> {
  const result = await runScriptTask(host, {
    task: "script_shots",
    modelId: input.modelId,
    prompt: breakIntoShotsPrompt(input),
    schema: shotsSchema,
    maxOutputTokens: 6_000,
  });
  if (!result.ok) return result;
  const knownScenes = new Set(input.scenes.map((scene) => scene.sceneId));
  const unknown = result.value.shots.filter((shot) => !knownScenes.has(shot.sceneId));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `The shot breakdown referenced scenes that are not in the script (${unknown.map((shot) => shot.sceneId).join(", ")}). Try again.`,
      denial: null,
    };
  }
  const outOfRange = result.value.shots.filter(
    (shot) => shot.duration < input.shotSeconds.min || shot.duration > input.shotSeconds.max,
  );
  if (outOfRange.length > 0) {
    return {
      ok: false,
      error: `The shot breakdown used clip lengths the video model cannot make (${outOfRange.map((shot) => `${shot.duration}s`).join(", ")}; allowed ${input.shotSeconds.min}-${input.shotSeconds.max}s). Try again.`,
      denial: null,
    };
  }
  return { ok: true, value: result.value.shots };
}
