export type SequenceAspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export type SequenceVoice = { model: string; voiceId: string };

export type SequenceVoiceAudio = {
  url: string;
  mediaId: string;
  seconds: number;
  model: string;
  voiceId: string;
  // The exact text the audio was made from.
  text: string;
};

export type SequenceVoiceover = { text: string; audio: SequenceVoiceAudio | null };

type SequenceItemText = { voiceover: SequenceVoiceover | null; onScreenText: string | null };

export type SequenceItem =
  | ({ sourceNodeId: string; kind: "video"; trimStart: number; trimEnd: number | null } & SequenceItemText)
  | ({ sourceNodeId: string; kind: "image"; holdSeconds: number } & SequenceItemText);

// Which caption layers the export burns in; null (nodes saved before
// captions existed) means none.
export type SequenceCaptions = { spoken: boolean; onScreen: boolean };

export type SequenceExport = { mediaId: string; url: string; exportedAt: string };

export type SequenceNodeData = {
  label: string;
  aspectRatio: SequenceAspectRatio;
  // The narrator for the whole cut; null until the user picks one.
  voice: SequenceVoice | null;
  items: SequenceItem[];
  captions: SequenceCaptions | null;
  lastExport: SequenceExport | null;
};

// What an item's source node holds right now. `seconds` is a clip's full
// length, known once its metadata has loaded; null until then.
export type SequenceMedia =
  | { kind: "video"; url: string; seconds: number | null }
  | { kind: "image"; url: string };

export const SEQUENCE_OUTPUT_SIZE: Record<SequenceAspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export const SEQUENCE_LIMITS = {
  minTotalSeconds: 1,
  maxTotalSeconds: 180,
  minHoldSeconds: 0.5,
  maxHoldSeconds: 10,
  defaultHoldSeconds: 3,
  fps: 30,
} as const;
