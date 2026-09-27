import type { Shot, ShotCameraMove, ShotFraming } from "./types";

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

const CAMERA_TEXT: Record<ShotCameraMove, string> = {
  static: "static locked-off camera",
  "push-in": "slow push-in",
  "pull-out": "slow pull-out",
  pan: "smooth pan",
  tilt: "smooth tilt",
  tracking: "tracking shot following the subject",
  orbit: "orbiting camera move around the subject",
  handheld: "handheld camera with natural movement",
  crane: "crane move rising over the scene",
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

function joinSentences(parts: string[]): string {
  return parts.map(sentence).filter(Boolean).join(" ");
}

function visualDescription(shot: Shot): string {
  return joinSentences([
    `${FRAMING_TEXT[shot.framing]}, ${CAMERA_TEXT[shot.cameraMove]}`,
    shot.action,
    shot.setting ? `Setting: ${shot.setting}` : "",
    shot.style ? `Style: ${shot.style}` : "",
  ]);
}

function onScreenLine(shot: Shot): string {
  return shot.onScreenText ? `On-screen text reads "${shot.onScreenText}".` : "";
}

// Veo: cinematography + subject/action + context + style, dialogue inline in
// quotes attributed to the speaker (Google's Veo 3.1 prompting guide).
function compileVeo(shot: Shot): string {
  const dialogue = shot.dialogue.map(
    (line) => `${line.character} says: "${line.line}"`,
  );
  const voiceover = shot.voiceover ? [`Narrator voiceover: "${shot.voiceover}"`] : [];
  return [visualDescription(shot), ...dialogue, ...voiceover, onScreenLine(shot)]
    .filter(Boolean)
    .join(" ");
}

// Sora: prose description, then a separate dialogue block (OpenAI's Sora 2
// prompting guide keeps speech out of the visual description).
function compileSora(shot: Shot): string {
  const speech = [
    ...shot.dialogue.map((line) => `- ${line.character}: "${line.line}"`),
    ...(shot.voiceover ? [`- Narrator (voiceover): "${shot.voiceover}"`] : []),
  ];
  return [
    visualDescription(shot),
    onScreenLine(shot),
    speech.length ? `Dialogue:\n${speech.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Seedance reads prompts like a shot list: a header with shot count and
// duration, then the shot.
function compileSeedance(shot: Shot): string {
  return [`Single shot, ${shot.duration}s.`, compileGeneric(shot)].join("\n");
}

function compileGeneric(shot: Shot): string {
  const dialogue = shot.dialogue.map(
    (line) => `${line.character} says: "${line.line}".`,
  );
  const voiceover = shot.voiceover ? [`Voiceover: "${shot.voiceover}".`] : [];
  return [visualDescription(shot), ...dialogue, ...voiceover, onScreenLine(shot)]
    .filter(Boolean)
    .join(" ");
}

export function compileShotPrompt(shot: Shot, family: ShotModelFamily): string {
  switch (family) {
    case "veo":
      return compileVeo(shot);
    case "sora":
      return compileSora(shot);
    case "seedance":
      return compileSeedance(shot);
    case "kling":
    case "generic":
      return compileGeneric(shot);
  }
}
