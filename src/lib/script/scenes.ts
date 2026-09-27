import {
  SCRIPT_BLOCK_TYPES,
  type ScriptBlock,
  type ScriptDoc,
  type ScriptLine,
  type ScriptLineKind,
  type ScriptScene,
  type ScriptText,
} from "./types";

const LINE_KINDS: Record<string, ScriptLineKind> = {
  [SCRIPT_BLOCK_TYPES.action]: "action",
  [SCRIPT_BLOCK_TYPES.voiceover]: "voiceover",
  [SCRIPT_BLOCK_TYPES.dialogue]: "dialogue",
  [SCRIPT_BLOCK_TYPES.onscreen]: "onscreen",
};

function isText(node: ScriptText | ScriptBlock): node is ScriptText {
  return typeof (node as ScriptText).text === "string";
}

export function blockText(block: ScriptBlock): string {
  return block.children
    .map((child) => (isText(child) ? child.text : blockText(child)))
    .join("");
}

function toLine(block: ScriptBlock): ScriptLine | null {
  const text = blockText(block).trim();
  if (!text) return null;
  return {
    kind: LINE_KINDS[block.type] ?? "action",
    text,
    character:
      block.type === SCRIPT_BLOCK_TYPES.dialogue && block.character
        ? block.character
        : null,
  };
}

// Blocks before the first scene heading (title notes, loose paragraphs) belong
// to no scene and never become shots.
export function extractScenes(doc: ScriptDoc): ScriptScene[] {
  const scenes: ScriptScene[] = [];
  for (const block of doc) {
    if (block.type === SCRIPT_BLOCK_TYPES.scene) {
      if (!block.sceneId) {
        throw new Error(
          `Scene "${blockText(block)}" has no sceneId; scene blocks must be created with one`,
        );
      }
      scenes.push({
        sceneId: block.sceneId,
        heading: blockText(block).trim(),
        seconds: typeof block.seconds === "number" ? block.seconds : null,
        lines: [],
      });
      continue;
    }
    const current = scenes.at(-1);
    const line = toLine(block);
    if (current && line) {
      current.lines.push(line);
    }
  }
  return scenes;
}

export function sceneToText(scene: ScriptScene): string {
  const lines = scene.lines.map((line) => {
    if (line.kind === "dialogue") return `${line.character ?? "CHARACTER"}: "${line.text}"`;
    if (line.kind === "voiceover") return `VO: "${line.text}"`;
    if (line.kind === "onscreen") return `ON-SCREEN TEXT: ${line.text}`;
    return line.text;
  });
  const timing = scene.seconds === null ? "" : ` (${scene.seconds}s)`;
  return [`SCENE: ${scene.heading}${timing}`, ...lines].join("\n");
}

export function scriptToText(doc: ScriptDoc): string {
  return extractScenes(doc).map(sceneToText).join("\n\n");
}

// FNV-1a over the scene's text; lets a shot tell whether its scene changed
// since the shot was made.
export function hashScene(scene: ScriptScene): string {
  const text = sceneToText(scene);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
