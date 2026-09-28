"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBoardStore } from "../../stores/board-store";
import { sourceMedia, validateSequence, type SequenceCheck } from "../../lib/sequence/model";
import type { SequenceMedia, SequenceNodeData } from "../../lib/sequence/types";

function loadClipSeconds(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve(video.duration);
      // Release the element's connection; only the length was needed.
      video.removeAttribute("src");
      video.load();
    };
    video.onerror = () => reject(new Error(`Could not read the length of ${url}`));
    video.src = url;
  });
}

export function useSequenceMedia(nodeId: string): {
  data: SequenceNodeData;
  mediaById: Record<string, SequenceMedia | null>;
  check: SequenceCheck;
  loadError: string | null;
} {
  const data = useBoardStore((state) => state.nodes.find((node) => node.id === nodeId)?.data as SequenceNodeData);
  const nodes = useBoardStore((state) => state.nodes);
  const [seconds, setSeconds] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const requested = useRef(new Set<string>());

  const baseMedia = useMemo(() => {
    const entries = data.items.map((item) => {
      const source = nodes.find((node) => node.id === item.sourceNodeId);
      return [item.sourceNodeId, source ? sourceMedia(source) : null] as const;
    });
    return Object.fromEntries(entries);
  }, [data.items, nodes]);

  useEffect(() => {
    for (const media of Object.values(baseMedia)) {
      if (media?.kind !== "video" || requested.current.has(media.url)) continue;
      requested.current.add(media.url);
      loadClipSeconds(media.url)
        .then((value) => setSeconds((previous) => ({ ...previous, [media.url]: value })))
        .catch((error: Error) => setLoadError(error.message));
    }
  }, [baseMedia]);

  const mediaById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(baseMedia).map(([id, media]) => [
          id,
          media?.kind === "video" ? { ...media, seconds: seconds[media.url] ?? null } : media,
        ]),
      ),
    [baseMedia, seconds],
  );

  return { data, mediaById, check: validateSequence(data.items, mediaById), loadError };
}
