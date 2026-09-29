import type { CanvasActions, LimitNotice } from "../../components/canvas-host/context";
import { limitNotice } from "../host/limit-notice";
import type { TextModelOption } from "../model-options";
import type { ScriptActionResult } from "./ai/generate";
import type { ScriptAssistant } from "./assistant";

type ScriptActions = Pick<
  CanvasActions,
  | "proposeScriptConcepts"
  | "writeScript"
  | "editScriptSelection"
  | "alternativeScriptHooks"
  | "critiqueScript"
  | "extractScriptEntities"
  | "breakScriptIntoShots"
>;

// Builds the Script node's AI help from the host's script server actions.
// Denials reach the host's limit UI, then every failure rejects with the
// action's message.
export function createScriptAssistant(input: {
  actions: ScriptActions;
  models: TextModelOption[];
  defaultModelId: string;
  onLimit: (notice: LimitNotice) => void;
  onSettled: () => void;
}): ScriptAssistant {
  const unwrap = async <T>(pending: Promise<ScriptActionResult<T>>): Promise<T> => {
    const result = await pending;
    input.onSettled();
    if (result.ok) return result.value;
    if (result.denial) input.onLimit(limitNotice(result.denial));
    throw new Error(result.error);
  };

  return {
    models: input.models,
    defaultModelId: input.defaultModelId,
    proposeConcepts: (args) => unwrap(input.actions.proposeScriptConcepts(args)),
    writeScript: (args) => unwrap(input.actions.writeScript(args)),
    editSelection: (args) => unwrap(input.actions.editScriptSelection(args)),
    alternativeHooks: (args) => unwrap(input.actions.alternativeScriptHooks(args)),
    critique: (args) => unwrap(input.actions.critiqueScript(args)),
    extractEntities: (args) => unwrap(input.actions.extractScriptEntities(args)),
    breakIntoShots: (args) => unwrap(input.actions.breakScriptIntoShots(args)),
  };
}
