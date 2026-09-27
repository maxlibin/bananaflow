// The script document is a Plate value: a flat list of top-level blocks.
// Screenplay blocks carry a `type` from SCRIPT_BLOCK_TYPES; a "scene" block
// opens a scene that owns every following block until the next scene.

export const SCRIPT_BLOCK_TYPES = {
  scene: "scene",
  action: "action",
  voiceover: "voiceover",
  dialogue: "dialogue",
  onscreen: "onscreen",
} as const;

export type ScriptBlockType =
  (typeof SCRIPT_BLOCK_TYPES)[keyof typeof SCRIPT_BLOCK_TYPES];

export type ScriptText = { text: string; [mark: string]: unknown };

export type ScriptBlock = {
  type: string;
  id?: string;
  children: Array<ScriptText | ScriptBlock>;
  // scene
  sceneId?: string;
  seconds?: number;
  // dialogue
  character?: string;
};

export type ScriptDoc = ScriptBlock[];

export type StructureId =
  | "hook-problem-solution-cta"
  | "ugc-testimonial"
  | "product-demo"
  | "before-after"
  | "three-act-story";

export type ScriptBriefAnswers = {
  product: string;
  audience: string;
  goal: string;
  tone: string;
  notes: string;
};

export type ScriptNodeData = {
  label: string;
  brief: ScriptBriefAnswers;
  title: string;
  logline: string;
  structureId: StructureId;
  targetDuration: number;
  platform: string;
  aspectRatio: string;
  doc: ScriptDoc;
};

export type ScriptLineKind = "action" | "voiceover" | "dialogue" | "onscreen";

export type ScriptLine = {
  kind: ScriptLineKind;
  text: string;
  character: string | null;
};

export type ScriptScene = {
  sceneId: string;
  heading: string;
  seconds: number | null;
  lines: ScriptLine[];
};

export const SHOT_FRAMINGS = [
  "extreme-wide",
  "wide",
  "medium",
  "close-up",
  "extreme-close-up",
  "over-the-shoulder",
  "pov",
] as const;

export type ShotFraming = (typeof SHOT_FRAMINGS)[number];

export const SHOT_CAMERA_MOVES = [
  "static",
  "push-in",
  "pull-out",
  "pan",
  "tilt",
  "tracking",
  "orbit",
  "handheld",
  "crane",
] as const;

export type ShotCameraMove = (typeof SHOT_CAMERA_MOVES)[number];

export type ShotDialogueLine = { character: string; line: string };

export type Shot = {
  scriptNodeId: string;
  sceneId: string;
  sceneHash: string;
  order: number;
  duration: number;
  framing: ShotFraming;
  cameraMove: ShotCameraMove;
  action: string;
  setting: string;
  style: string;
  dialogue: ShotDialogueLine[];
  voiceover: string;
  onScreenText: string;
};

export type ShotNodeData = {
  label: string;
  shot: Shot;
  // Compiled, model-ready prompt. Output and video nodes read `value` and
  // `images` from whatever is wired into their "input" handle.
  value: string;
  images: Array<{
    imageUrl: string;
    blobPath?: string;
    fileName?: string;
    fileSize?: number;
  }>;
};
