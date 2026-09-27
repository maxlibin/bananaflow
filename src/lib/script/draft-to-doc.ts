import type { ScriptDraft, ScriptDraftLine } from "./assistant";
import { SCRIPT_BLOCK_TYPES, type ScriptBlock, type ScriptDoc } from "./types";

function lineToBlock(line: ScriptDraftLine): ScriptBlock {
  const block: ScriptBlock = {
    type: SCRIPT_BLOCK_TYPES[line.kind],
    children: [{ text: line.text }],
  };
  if (line.kind === "dialogue") {
    block.character = (line.character ?? "").toUpperCase();
  }
  return block;
}

export function draftToDoc(draft: ScriptDraft, createSceneId: () => string): ScriptDoc {
  return draft.scenes.flatMap((scene) => [
    {
      type: SCRIPT_BLOCK_TYPES.scene,
      sceneId: createSceneId(),
      seconds: scene.seconds,
      children: [{ text: scene.heading }],
    },
    ...scene.lines.map(lineToBlock),
  ]);
}
