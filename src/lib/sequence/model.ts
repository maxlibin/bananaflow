import type { Edge, Node } from "@xyflow/react";
import {
  SEQUENCE_LIMITS,
  SEQUENCE_OUTPUT_SIZE,
  type SequenceAspectRatio,
  type SequenceItem,
  type SequenceMedia,
  type SequenceVoice,
} from "./types";
import { voiceoverStatus } from "./voiceover";

export class InvalidSequenceEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSequenceEditError";
  }
}

export type SequenceCheck = { ok: true; totalSeconds: number } | { ok: false; reason: string };

type MediaFields = {
  videoUrl?: string;
  imageUrl?: string;
  result?: { videoUrl?: string; imageUrl?: string; imageUrls?: string[] };
  images?: Array<{ imageUrl?: string }>;
};

export function sourceKind(node: Node): "video" | "image" | null {
  if (node.type === "videoNode") return "video";
  if (node.type === "outputNode" || node.type === "imageNode" || node.type === "inputNode") return "image";
  return null;
}

export function sourceMedia(node: Node): SequenceMedia | null {
  const data = (node.data ?? {}) as MediaFields;
  const kind = sourceKind(node);
  if (kind === "video") {
    const url = data.result?.videoUrl ?? data.videoUrl;
    return url ? { kind: "video", url, seconds: null } : null;
  }
  if (kind === "image") {
    const url =
      data.result?.imageUrls?.[0] ?? data.result?.imageUrl ?? data.imageUrl ?? data.images?.[0]?.imageUrl;
    return url ? { kind: "image", url } : null;
  }
  return null;
}

// Text a Shot node carries for the video it feeds.
export type ShotLines = { voiceover: string; onScreenText: string };

// Edges decide membership: items of disconnected sources are dropped, new
// sources are appended in `sources` order, existing items keep their edits.
// `lines` pre-fills new items' voiceover and on-screen text from the Shot
// node feeding their source (see shotLines).
export function syncSequenceItems(
  items: SequenceItem[],
  sources: Node[],
  lines: Record<string, ShotLines>,
): SequenceItem[] {
  const connected = new Map<string, "video" | "image">();
  for (const source of sources) {
    const kind = sourceKind(source);
    if (kind) connected.set(source.id, kind);
  }
  // Items saved before voiceover or captions existed lack those fields.
  const kept = items
    .filter((item) => connected.get(item.sourceNodeId) === item.kind)
    .map((item) => ({ ...item, voiceover: item.voiceover ?? null, onScreenText: item.onScreenText ?? null }));
  const keptIds = new Set(kept.map((item) => item.sourceNodeId));
  const added: SequenceItem[] = [];
  for (const [sourceNodeId, kind] of connected) {
    if (keptIds.has(sourceNodeId)) continue;
    const shot = lines[sourceNodeId];
    const voiceover = shot?.voiceover ? { text: shot.voiceover, audio: null } : null;
    const onScreenText = shot?.onScreenText || null;
    added.push(
      kind === "video"
        ? { sourceNodeId, kind, trimStart: 0, trimEnd: null, voiceover, onScreenText }
        : { sourceNodeId, kind, holdSeconds: SEQUENCE_LIMITS.defaultHoldSeconds, voiceover, onScreenText },
    );
  }
  return [...kept, ...added];
}

// Voiceover and on-screen text of the Shot node feeding each video node,
// keyed by video id; shots with neither are left out.
export function shotLines(nodes: Node[], edges: Edge[]): Record<string, ShotLines> {
  const lines: Record<string, ShotLines> = {};
  for (const edge of edges) {
    const source = nodes.find((node) => node.id === edge.source);
    if (source?.type !== "shotNode") continue;
    const shot = (source.data as { shot?: { voiceover?: string; onScreenText?: string } }).shot;
    const voiceover = (shot?.voiceover ?? "").trim();
    const onScreenText = (shot?.onScreenText ?? "").trim();
    if (voiceover || onScreenText) lines[edge.target] = { voiceover, onScreenText };
  }
  return lines;
}

function requireIndex(items: SequenceItem[], index: number): SequenceItem {
  const item = items[index];
  if (!item) throw new InvalidSequenceEditError(`No item at position ${index + 1}`);
  return item;
}

export function moveItem(items: SequenceItem[], from: number, to: number): SequenceItem[] {
  const item = requireIndex(items, from);
  requireIndex(items, to);
  const rest = items.filter((_, index) => index !== from);
  return [...rest.slice(0, to), item, ...rest.slice(to)];
}

export function setTrim(
  items: SequenceItem[],
  index: number,
  trimStart: number,
  trimEnd: number | null,
  clipSeconds: number,
): SequenceItem[] {
  const item = requireIndex(items, index);
  if (item.kind !== "video") throw new InvalidSequenceEditError(`Item ${index + 1} is a still; set its hold time instead`);
  const end = trimEnd ?? clipSeconds;
  if (!(trimStart >= 0 && trimStart < end && end <= clipSeconds)) {
    throw new InvalidSequenceEditError(
      `Trim ${trimStart}-${end}s does not fit item ${index + 1}'s ${clipSeconds}s clip`,
    );
  }
  return items.map((existing, position) =>
    position === index ? { ...item, trimStart, trimEnd } : existing,
  );
}

export function setHold(items: SequenceItem[], index: number, holdSeconds: number): SequenceItem[] {
  const item = requireIndex(items, index);
  if (item.kind !== "image") throw new InvalidSequenceEditError(`Item ${index + 1} is a clip; trim it instead`);
  const { minHoldSeconds, maxHoldSeconds } = SEQUENCE_LIMITS;
  if (!(holdSeconds >= minHoldSeconds && holdSeconds <= maxHoldSeconds)) {
    throw new InvalidSequenceEditError(`Stills hold for ${minHoldSeconds}-${maxHoldSeconds}s; got ${holdSeconds}s`);
  }
  return items.map((existing, position) => (position === index ? { ...item, holdSeconds } : existing));
}

// Seconds an item contributes to the cut. Throws when a clip's length is
// still unknown; validateSequence reports that case instead of throwing.
export function itemSeconds(item: SequenceItem, media: SequenceMedia): number {
  if (item.kind === "image") return item.holdSeconds;
  if (media.kind !== "video" || media.seconds === null) {
    throw new InvalidSequenceEditError(`Clip ${item.sourceNodeId} has no known length yet`);
  }
  return (item.trimEnd ?? media.seconds) - item.trimStart;
}

export function validateSequence(
  items: SequenceItem[],
  mediaById: Record<string, SequenceMedia | null>,
  voice: SequenceVoice | null,
): SequenceCheck {
  if (items.length === 0) return { ok: false, reason: "Add at least one clip or image" };
  let totalSeconds = 0;
  for (const [index, item] of items.entries()) {
    const label = `Item ${index + 1}`;
    const media = mediaById[item.sourceNodeId] ?? null;
    if (!media) return { ok: false, reason: `${label} has no media yet` };
    if (item.kind === "video") {
      if (media.kind !== "video") return { ok: false, reason: `${label} is no longer a clip` };
      if (media.seconds === null) return { ok: false, reason: `${label} is still loading its length` };
      const end = item.trimEnd ?? media.seconds;
      if (item.trimStart >= end) {
        return { ok: false, reason: `${label} starts at ${item.trimStart}s but its clip is only ${media.seconds}s long` };
      }
      if (end > media.seconds) {
        return { ok: false, reason: `${label} ends at ${end}s but its clip is only ${media.seconds}s long` };
      }
    }
    const seconds = itemSeconds(item, media);
    // The export renders whole frames, so a line must fit the rendered length.
    const renderedSeconds = itemFrames(item, media) / SEQUENCE_LIMITS.fps;
    const status = voiceoverStatus(item.voiceover ?? null, voice, renderedSeconds);
    if (status === "unvoiced") return { ok: false, reason: `${label}'s voiceover is not voiced yet` };
    if (status === "stale") {
      return { ok: false, reason: voice ? `${label}'s voiceover needs voicing again` : "Pick a voice for the voiceover" };
    }
    if (status === "too-long") {
      const spoken = (item.voiceover?.audio?.seconds ?? 0).toFixed(1);
      return { ok: false, reason: `${label}'s voiceover is ${spoken}s but the clip is ${renderedSeconds.toFixed(1)}s` };
    }
    totalSeconds += seconds;
  }
  const { minTotalSeconds, maxTotalSeconds } = SEQUENCE_LIMITS;
  if (totalSeconds < minTotalSeconds) return { ok: false, reason: `The cut is ${totalSeconds}s; it needs at least ${minTotalSeconds}s` };
  if (totalSeconds > maxTotalSeconds) return { ok: false, reason: `The cut is ${totalSeconds}s; the limit is ${maxTotalSeconds}s` };
  return { ok: true, totalSeconds };
}

export function toSequenceAspect(value: string): SequenceAspectRatio {
  if (!(value in SEQUENCE_OUTPUT_SIZE)) {
    throw new InvalidSequenceEditError(`Sequences cannot render at ${value}; use ${Object.keys(SEQUENCE_OUTPUT_SIZE).join(", ")}`);
  }
  return value as SequenceAspectRatio;
}

// Whole output frames an item occupies. Video and audio both use
// frames / fps, so rounding never lets them drift apart across items.
export function itemFrames(item: SequenceItem, media: SequenceMedia): number {
  return Math.round(itemSeconds(item, media) * SEQUENCE_LIMITS.fps);
}

// A regenerated take forks into a new node; the cut follows the new take
// and keeps the item's trims.
export function retargetSequenceSource(
  nodes: Node[],
  edges: Edge[],
  fromId: string,
  toId: string,
): { nodes: Node[]; edges: Edge[] } {
  return {
    edges: edges.map((edge) =>
      edge.source === fromId && edge.targetHandle === "items" ? { ...edge, source: toId } : edge,
    ),
    nodes: nodes.map((node) => {
      if (node.type !== "sequenceNode") return node;
      const data = node.data as { items: SequenceItem[] };
      if (!data.items.some((item) => item.sourceNodeId === fromId)) return node;
      return {
        ...node,
        data: {
          ...node.data,
          items: data.items.map((item) => (item.sourceNodeId === fromId ? { ...item, sourceNodeId: toId } : item)),
        },
      };
    }),
  };
}

// Remote (cross-origin) files ignore <a download> and would navigate away,
// so they download through the app's own route.
export function downloadHref(url: string, filename: string): string {
  if (url.startsWith("/")) return url;
  return `/api/download-asset?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
}
