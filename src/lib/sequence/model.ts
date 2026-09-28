import type { Node } from "@xyflow/react";
import { SEQUENCE_LIMITS, type SequenceItem, type SequenceMedia } from "./types";

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

// Edges decide membership: items of disconnected sources are dropped, new
// sources are appended in `sources` order, existing items keep their edits.
export function syncSequenceItems(items: SequenceItem[], sources: Node[]): SequenceItem[] {
  const connected = new Map<string, "video" | "image">();
  for (const source of sources) {
    const kind = sourceKind(source);
    if (kind) connected.set(source.id, kind);
  }
  const kept = items.filter((item) => connected.get(item.sourceNodeId) === item.kind);
  const keptIds = new Set(kept.map((item) => item.sourceNodeId));
  const added: SequenceItem[] = [];
  for (const [sourceNodeId, kind] of connected) {
    if (keptIds.has(sourceNodeId)) continue;
    added.push(
      kind === "video"
        ? { sourceNodeId, kind, trimStart: 0, trimEnd: null }
        : { sourceNodeId, kind, holdSeconds: SEQUENCE_LIMITS.defaultHoldSeconds },
    );
  }
  return [...kept, ...added];
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
      if (end > media.seconds) {
        return { ok: false, reason: `${label} ends at ${end}s but its clip is only ${media.seconds}s long` };
      }
    }
    totalSeconds += itemSeconds(item, media);
  }
  const { minTotalSeconds, maxTotalSeconds } = SEQUENCE_LIMITS;
  if (totalSeconds < minTotalSeconds) return { ok: false, reason: `The cut is ${totalSeconds}s; it needs at least ${minTotalSeconds}s` };
  if (totalSeconds > maxTotalSeconds) return { ok: false, reason: `The cut is ${totalSeconds}s; the limit is ${maxTotalSeconds}s` };
  return { ok: true, totalSeconds };
}
