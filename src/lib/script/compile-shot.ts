import { getDirectionPreset } from "../direction/presets";
import type { ScriptNodeData, Shot, ShotFraming } from "./types";

// The script-wide look and lighting a shot falls back to.
export type ScriptDirection = Pick<ScriptNodeData, "look" | "lighting">;

export type ShotModelFamily = "veo" | "sora" | "kling" | "seedance" | "generic";

const FRAMING_TEXT: Record<ShotFraming, string> = {
  "extreme-wide": "Extreme wide shot",
  wide: "Wide shot",
  medium: "Medium shot",
  "close-up": "Close-up",
  "extreme-close-up": "Extreme close-up",
  "over-the-shoulder": "Over-the-shoulder shot",
  pov: "POV shot",
};


export function modelFamilyFromModelId(modelId: string): ShotModelFamily {
  const id = modelId.toLowerCase();
  if (id.includes("veo")) return "veo";
  if (id.includes("sora")) return "sora";
  if (id.includes("kling")) return "kling";
  if (id.includes("seedance")) return "seedance";
  return "generic";
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// Ends a quoted line with a full stop unless the quote already ends one.
function closeQuote(quoted: string, inner: string): string {
  return /[.!?]$/.test(inner.trim()) ? quoted : `${quoted}.`;
}

function joinSentences(parts: string[]): string {
  return parts.map(sentence).filter(Boolean).join(" ");
}

// Lens, look and lighting as prompt phrases. Shots saved before presets have
// no lens/look/lighting fields, hence the `?? null`.
function directionPhrases(shot: Shot, script: ScriptDirection) {
  const lens = shot.lens ?? null;
  const look = shot.look ?? script.look;
  const lighting = shot.lighting ?? script.lighting;
  return {
    lens: lens ? getDirectionPreset("lens", lens).prompt : "",
    look: look ? getDirectionPreset("look", look).prompt : "",
    lighting: lighting ? getDirectionPreset("lighting", lighting).prompt : "",
  };
}

function styleLine(shot: Shot, look: string): string {
  const style = [shot.style.trim().replace(/[.!?]+$/, ""), look].filter(Boolean).join(", ");
  return style ? `Style: ${style}` : "";
}

function visualDescription(shot: Shot, script: ScriptDirection): string {
  const direction = directionPhrases(shot, script);
  const camera = getDirectionPreset("camera", shot.cameraMove).prompt;
  return joinSentences([
    [`${FRAMING_TEXT[shot.framing]}, ${camera}`, direction.lens].filter(Boolean).join(", "),
    shot.action,
    shot.setting ? `Setting: ${shot.setting}` : "",
    direction.lighting ? `Lighting: ${direction.lighting}` : "",
    styleLine(shot, direction.look),
  ]);
}

function onScreenLine(shot: Shot): string {
  return shot.onScreenText ? `On-screen text reads "${shot.onScreenText}".` : "";
}

// Veo: cinematography + subject/action + context + style, dialogue inline in
// quotes attributed to the speaker (Google's Veo 3.1 prompting guide).
function compileVeo(shot: Shot, script: ScriptDirection): string {
  const dialogue = shot.dialogue.map(
    (line) => `${line.character} says: "${line.line}"`,
  );
  const voiceover = shot.voiceover ? [`Narrator voiceover: "${shot.voiceover}"`] : [];
  return [visualDescription(shot, script), ...dialogue, ...voiceover, onScreenLine(shot)]
    .filter(Boolean)
    .join(" ");
}

// Sora: prose description, then a separate dialogue block (OpenAI's Sora 2
// prompting guide keeps speech out of the visual description).
function compileSora(shot: Shot, script: ScriptDirection): string {
  const speech = [
    ...shot.dialogue.map((line) => `- ${line.character}: "${line.line}"`),
    ...(shot.voiceover ? [`- Narrator (voiceover): "${shot.voiceover}"`] : []),
  ];
  return [
    visualDescription(shot, script),
    onScreenLine(shot),
    speech.length ? `Dialogue:\n${speech.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Seedance reads prompts like a shot list: a header with shot count and
// duration, then the shot.
function compileSeedance(shot: Shot, script: ScriptDirection): string {
  return [`Single shot, ${shot.duration}s.`, compileGeneric(shot, script)].join("\n");
}

function compileGeneric(shot: Shot, script: ScriptDirection): string {
  const dialogue = shot.dialogue.map(
    (line) => closeQuote(`${line.character} says: "${line.line}"`, line.line),
  );
  const voiceover = shot.voiceover
    ? [closeQuote(`Voiceover: "${shot.voiceover}"`, shot.voiceover)]
    : [];
  return [visualDescription(shot, script), ...dialogue, ...voiceover, onScreenLine(shot)]
    .filter(Boolean)
    .join(" ");
}

export function compileShotPrompt(
  shot: Shot,
  family: ShotModelFamily,
  script: ScriptDirection,
): string {
  switch (family) {
    case "veo":
      return compileVeo(shot, script);
    case "sora":
      return compileSora(shot, script);
    case "seedance":
      return compileSeedance(shot, script);
    case "kling":
    case "generic":
      return compileGeneric(shot, script);
  }
}

// Keyframe prompt for an image model: what one frame of the shot looks like.
// No camera motion or dialogue, which image models render as blur or text.
export function compileStillPrompt(shot: Shot, script: ScriptDirection): string {
  const direction = directionPhrases(shot, script);
  return joinSentences([
    [`Single cinematic still frame, ${FRAMING_TEXT[shot.framing].toLowerCase()}`, direction.lens]
      .filter(Boolean)
      .join(", "),
    shot.action,
    shot.setting ? `Setting: ${shot.setting}` : "",
    direction.lighting ? `Lighting: ${direction.lighting}` : "",
    styleLine(shot, direction.look),
  ]);
}
