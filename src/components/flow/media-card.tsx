"use client";

import { useCanvasHost } from "../canvas-host/context";
import Image from "next/image";
import { Pin, RefreshCw, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import type { HistoryEntry } from "../../types/run-history";

type MediaCardProps = {
  entry: HistoryEntry;
  onVariations?: (entry: HistoryEntry) => void;
  onRerun?: (entry: HistoryEntry) => void;
  onPinChange?: (entry: HistoryEntry, pinned: boolean) => void;
  className?: string;
};

export function MediaCard({
  entry,
  onVariations,
  onRerun,
  onPinChange,
  className,
}: MediaCardProps) {
  const { actions, track } = useCanvasHost();
  const [isPending, startTransition] = useTransition();

  const handlePin = () => {
    startTransition(async () => {
      const next = !entry.pinned;
      const result = await actions.pinMedia(entry.id, next);
      if (result.success) {
        track("history.pinned", { mediaId: entry.id, on: next });
        onPinChange?.(entry, next);
      }
    });
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-md border bg-background",
        className,
      )}
    >
      {!entry.url ? (
        <div className="flex h-full w-full items-center justify-center bg-muted text-[11px] text-muted-foreground">
          {entry.errorMessage ? "" : "Pending…"}
        </div>
      ) : entry.type === "IMAGE" ? (
        <Image
          src={entry.url}
          alt={entry.prompt ?? "Generated image"}
          width={entry.width ?? 512}
          height={entry.height ?? 512}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <video
          src={entry.url}
          className="h-full w-full object-cover"
          controls
          preload="metadata"
        />
      )}
      {entry.errorMessage && (
        <div className="absolute inset-x-0 top-0 bg-destructive/90 px-2 py-1 text-xs text-destructive-foreground">
          Failed: {entry.errorMessage}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/40" />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-end gap-1 p-2 opacity-0 transition group-hover:opacity-100">
        <div className="pointer-events-auto flex gap-1">
          {onVariations && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onVariations(entry)}
              title="Make variations"
            >
              <Sparkles className="h-3 w-3" />
            </Button>
          )}
          {onRerun && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onRerun(entry)}
              title="Re-run"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant={entry.pinned ? "default" : "secondary"}
            disabled={isPending}
            onClick={handlePin}
            title={entry.pinned ? "Unpin" : "Pin"}
          >
            <Pin className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {entry.source === "chat" && (
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px]">
          Chat
        </div>
      )}
    </div>
  );
}
