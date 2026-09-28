import type { TextModelOption } from "../model-options";
import type {
  EntityKind,
  ScriptBriefAnswers,
  ShotCameraMove,
  ShotDialogueLine,
  ShotFraming,
  StructureId,
} from "./types";

export type ScriptBrief = ScriptBriefAnswers & {
  platform: string;
  targetDuration: number;
  structureId: StructureId;
};

export type ScriptConcept = {
  title: string;
  logline: string;
  angle: string;
  hook: string;
};

export type ScriptDraftLine = {
  kind: "action" | "voiceover" | "dialogue" | "onscreen";
  text: string;
  character: string | null;
};

export type ScriptDraftScene = {
  heading: string;
  seconds: number;
  lines: ScriptDraftLine[];
};

export type ScriptDraft = {
  title: string;
  logline: string;
  scenes: ScriptDraftScene[];
};

export type CritiqueScore = { score: number; note: string };

export type ScriptCritique = {
  overall: number;
  hook: CritiqueScore;
  clarity: CritiqueScore;
  pacing: CritiqueScore;
  visualFeasibility: CritiqueScore;
  callToAction: CritiqueScore;
  fixes: Array<{ sceneHeading: string | null; issue: string; suggestion: string }>;
};

export type ShotPlan = {
  sceneId: string;
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
  entities: string[];
};

export type EntityDraft = {
  kind: EntityKind;
  name: string;
  look: string;
};

export type ScriptWritingModel = TextModelOption;

// AI help for the Script node. Hosts without an LLM pass null and the script
// editor works without AI. Every method rejects with a descriptive Error on
// failure (including credit or rate-limit denials, which the host reports
// through its own limit UI first).
export type ScriptAssistant = {
  models: ScriptWritingModel[];
  defaultModelId: string;
  proposeConcepts: (input: {
    brief: ScriptBrief;
    modelId: string;
  }) => Promise<ScriptConcept[]>;
  writeScript: (input: {
    brief: ScriptBrief;
    concept: ScriptConcept;
    modelId: string;
  }) => Promise<ScriptDraft>;
  editSelection: (input: {
    instruction: string;
    selectedText: string;
    scriptText: string;
  }) => Promise<string>;
  alternativeHooks: (input: {
    scriptText: string;
    currentHook: string;
    count: number;
  }) => Promise<string[]>;
  critique: (input: {
    scriptText: string;
    targetDuration: number;
    platform: string;
    modelId: string;
  }) => Promise<ScriptCritique>;
  extractEntities: (input: {
    scriptText: string;
    modelId: string;
  }) => Promise<EntityDraft[]>;
  breakIntoShots: (input: {
    scenes: Array<{ sceneId: string; text: string; seconds: number }>;
    entities: EntityDraft[];
    aspectRatio: string;
    // Clip lengths the chosen video model can produce, in whole seconds.
    shotSeconds: { min: number; max: number };
    modelId: string;
  }) => Promise<ShotPlan[]>;
};
