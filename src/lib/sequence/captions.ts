import { InvalidSequenceEditError, itemFrames } from "./model";
import { voiceoverStatus } from "./voiceover";
import {
  SEQUENCE_LIMITS,
  type SequenceCaptions,
  type SequenceItem,
  type SequenceMedia,
  type SequenceVoice,
} from "./types";

export const MAX_ON_SCREEN_CHARACTERS = 80;
const MAX_CHUNK_WORDS = 3;
const MAX_CHUNK_CHARACTERS = 22;

// Where each layer sits and how tall its text is, as fractions of the frame
// height; the export and the preview player share these.
export const CAPTION_LAYOUT = {
  spoken: { y: 0.72, size: 0.05 },
  onScreen: { y: 0.14, size: 0.045 },
} as const;
// Outline width as a fraction of the font size.
export const CAPTION_OUTLINE = 0.18;
// Text wraps (and, failing that, shrinks) to fit this share of the width.
export const CAPTION_MAX_WIDTH = 0.9;

// Seconds on the cut's timeline.
export type CaptionCue = { start: number; end: number; text: string; layer: "spoken" | "onScreen" };

// Caption chunks with the character index each one starts at in `text`.
function chunkSpans(text: string): Array<{ text: string; start: number }> {
  const spans: Array<{ text: string; start: number; words: number }> = [];
  for (const word of text.matchAll(/\S+/g)) {
    const current = spans[spans.length - 1];
    const joined = current ? `${current.text} ${word[0]}` : "";
    if (current && current.words < MAX_CHUNK_WORDS && joined.length <= MAX_CHUNK_CHARACTERS) {
      spans[spans.length - 1] = { text: joined, start: current.start, words: current.words + 1 };
    } else {
      spans.push({ text: word[0], start: word.index, words: 1 });
    }
  }
  return spans.map(({ text: chunk, start }) => ({ text: chunk, start }));
}

// Up to 3 words or 22 characters per caption card; a longer word stands alone.
export function chunkWords(text: string): string[] {
  return chunkSpans(text).map((span) => span.text);
}

// A ready line's audio is split across its chunks by character position:
// providers return no word timings, and ~3-word cards land close enough.
function spokenCues(text: string, start: number, seconds: number): CaptionCue[] {
  const spans = chunkSpans(text);
  return spans.map((span, index) => ({
    start: start + seconds * (span.start / text.length),
    end: index + 1 < spans.length ? start + seconds * (spans[index + 1].start / text.length) : start + seconds,
    text: span.text,
    layer: "spoken",
  }));
}

export function captionCues(
  items: SequenceItem[],
  mediaById: Record<string, SequenceMedia>,
  voice: SequenceVoice | null,
  captions: SequenceCaptions | null,
): CaptionCue[] {
  if (!captions) return [];
  const cues: CaptionCue[] = [];
  let offset = 0;
  for (const item of items) {
    // Whole frames, exactly as the export lays items out.
    const seconds = itemFrames(item, mediaById[item.sourceNodeId]) / SEQUENCE_LIMITS.fps;
    const voiceover = item.voiceover ?? null;
    if (captions.spoken && voiceover?.audio && voiceoverStatus(voiceover, voice, seconds) === "ready") {
      cues.push(...spokenCues(voiceover.text, offset, voiceover.audio.seconds));
    }
    if (captions.onScreen && item.onScreenText) {
      cues.push({ start: offset, end: offset + seconds, text: item.onScreenText, layer: "onScreen" });
    }
    offset += seconds;
  }
  return cues;
}

// Cues showing at `time` that belong to the item playing from itemStart to
// itemEnd: a clip can play briefly past its trim end before the preview
// advances, and must not show the next item's cues meanwhile.
export function activeCues(cues: CaptionCue[], time: number, itemStart: number, itemEnd: number): CaptionCue[] {
  return cues.filter((cue) => cue.start <= time && time < cue.end && cue.start < itemEnd && cue.end > itemStart);
}

function srtTime(seconds: number): string {
  const total = Math.round(seconds * 1000);
  const pad = (value: number, width: number) => String(value).padStart(width, "0");
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor(total / 60_000) % 60;
  const secs = Math.floor(total / 1000) % 60;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(total % 1000, 3)}`;
}

// Spoken cues only: on-screen titles are part of the picture, not subtitles.
export function toSrt(cues: CaptionCue[]): string {
  return cues
    .filter((cue) => cue.layer === "spoken")
    .map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`)
    .join("\n");
}

export function setOnScreenText(items: SequenceItem[], index: number, text: string): SequenceItem[] {
  const item = items[index];
  if (!item) throw new InvalidSequenceEditError(`No item at position ${index + 1}`);
  const trimmed = text.trim();
  if (trimmed.length > MAX_ON_SCREEN_CHARACTERS) {
    throw new InvalidSequenceEditError(
      `On-screen text is at most ${MAX_ON_SCREEN_CHARACTERS} characters; this one is ${trimmed.length}`,
    );
  }
  const onScreenText = trimmed.length === 0 ? null : trimmed;
  return items.map((existing, position) => (position === index ? { ...item, onScreenText } : existing));
}
