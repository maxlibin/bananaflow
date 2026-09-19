"use client";

import { useCanvasHost } from "../canvas-host/context";
import { useEffect, useState, useTransition } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { MediaCard } from "./media-card";
import { getModelLabel } from "../../lib/model-labels";
import { BulkRunCard } from "./bulk-run-card";
import { useBoardStore } from "../../stores/board-store";
import { notifyDialog } from "../ui/dialog-host";
import type { HistoryEntry, HistoryGroup } from "../../types/run-history";
import { useMediaPanel } from "./media-panel-context";
import { useHistoryPanel } from "./history-panel-context";

export function HistoryPanel() {
  const { actions, track } = useCanvasHost();
  const boardId = useBoardStore((state) => state.boardId);
  const { isOpen: mediaOpen } = useMediaPanel();
  const generateImage = useBoardStore(
    useShallow((state) => state.generateImage),
  );
  const generateVideo = useBoardStore(
    useShallow((state) => state.generateVideo),
  );
  const getNodeById = useBoardStore((state) => state.getNodeById);

  const [groups, setGroups] = useState<HistoryGroup[]>([]);
  const { isOpen: open, setOpen } = useHistoryPanel();
  const [, startTransition] = useTransition();

  const refresh = () => {
    if (!boardId) return;
    startTransition(async () => {
      const result = await actions.getBoardHistory(boardId);
      if (result.success) setGroups(result.groups);
    });
  };

  useEffect(() => {
    if (open && boardId) {
      track("history.opened");
      refresh();
    }
  }, [open, boardId]);

  const onVariations = async (entry: HistoryEntry) => {
    track("generation.variations_clicked", {
      parentMediaId: entry.id,
      kind: entry.type === "VIDEO" ? "video" : "image",
      requested: 4,
    });
    const result = await actions.runVariations(entry.id, 4);
    if (!result.success) {
      await notifyDialog({
        title: "Can't make variations",
        description: result.error,
      });
      return;
    }

    if (!result.nodeId || !getNodeById(result.nodeId)) {
      await notifyDialog({
        title: "Source node not found",
        description:
          "The output node that produced this run no longer exists on the board. Re-add an output node to continue.",
      });
      return;
    }

    const connected = {
      prompt: result.snapshot.prompt,
      images: result.snapshot.images.map((image) => ({
        nodeId: image.nodeId ?? "",
        imageUrl: image.imageUrl,
        blobPath: image.blobPath,
      })),
      model: result.snapshot.model,
    };

    if (result.kind === "image") {
      await generateImage(result.nodeId, connected, {
        parentMediaId: result.parentMediaId,
        variants: result.snapshot.variants,
      });
    } else {
      await generateVideo(result.nodeId, connected, {
        parentMediaId: result.parentMediaId,
        variants: result.snapshot.variants,
      });
    }
    refresh();
  };

  if (!boardId) return null;

  return (
    <>
      {!open && (
        <Button
          variant="outline"
          size="sm"
          className={`absolute top-4 z-30 ${mediaOpen ? "right-[26rem]" : "right-32"}`}
          onClick={() => setOpen(true)}
          aria-label={
            groups.length > 0
              ? `Open run history (${groups.length} runs)`
              : "Open run history"
          }
        >
          History {groups.length > 0 ? `(${groups.length})` : ""}
        </Button>
      )}
      {open && (
        <div className="absolute right-0 top-0 z-20 flex h-full w-96 flex-col border-l bg-background shadow-lg">
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm font-medium">
              Run history{groups.length > 0 ? ` (${groups.length})` : ""}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={refresh}>
                Refresh
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
                aria-label="Close history"
              >
                ✕
              </Button>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-3 p-3">
              {groups.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Generate something to start your history.
                </p>
              )}
              {groups.map((group) => (
                <div
                  key={group.runGroupId ?? group.entries[0]?.id}
                  className="flex flex-col gap-2 rounded-md border p-2"
                >
                  {group.runGroupId ? (
                    <BulkRunCard bulkRunId={group.runGroupId} />
                  ) : null}
                  <div className="text-[11px] text-muted-foreground">
                    {getModelLabel(group.entries[0]?.modelSnapshot?.model)} ·{" "}
                    {group.entries.length} variant
                    {group.entries.length > 1 ? "s" : ""}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.entries.map((entry) => (
                      <MediaCard
                        key={entry.id}
                        entry={entry}
                        onVariations={onVariations}
                        onPinChange={refresh}
                        className="aspect-square"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </>
  );
}
