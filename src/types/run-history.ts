import type { Media, MediaSourceValue } from "../db/schema";

export type MediaSource = MediaSourceValue;

export type ModelSnapshot = {
  kind: "image" | "video";
  model: string;
  prompt: string;
  images: Array<{ imageUrl: string; nodeId?: string; blobPath?: string }>;
  settings: Record<string, unknown>;
  variants: number;
  seed?: number | string;
};

export type HistoryEntry = {
  id: string;
  type: Media["type"];
  url: string;
  blobPath: string | null;
  width: number | null;
  height: number | null;
  prompt: string | null;
  boardId: string | null;
  nodeId: string | null;
  runGroupId: string | null;
  parentMediaId: string | null;
  source: MediaSource;
  chatMessageId: string | null;
  pinned: boolean;
  errorMessage: string | null;
  modelSnapshot: ModelSnapshot | null;
  createdAt: Date;
};

export type HistoryGroup = {
  runGroupId: string | null;
  createdAt: Date;
  source: MediaSource;
  chatMessageId: string | null;
  entries: HistoryEntry[];
};
