"use client";

import { useCanvasHost } from "../canvas-host/context";
import { useEffect, useState, useTransition } from "react";
import { Button } from "../ui/button";
import { MediaCard } from "./media-card";
import { getModelLabel } from "../../lib/model-labels";
import { notifyDialog } from "../ui/dialog-host";
import type { BulkRunWithItems } from "../../types/bulk-run";
import type { HistoryEntry } from "../../types/run-history";

const TERMINAL_STATUSES = new Set([
  "completed",
  "cancelled",
  "failed",
]);

export function BulkRunCard({ bulkRunId }: { bulkRunId: string }) {
  const { actions, track } = useCanvasHost();
  const [run, setRun] = useState<BulkRunWithItems | null>(null);
  const [missing, setMissing] = useState(false);
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      const result = await actions.getBulkRun(bulkRunId);
      if (cancelled) return;
      if (!result.success) {
        setMissing(true);
        return;
      }
      setRun(result.run);
      if (TERMINAL_STATUSES.has(result.run.status)) {
        track("bulk.completed", {
          bulkRunId,
          completed: result.run.completed,
          failed: result.run.failed,
          durationMs:
            Date.now() - new Date(result.run.createdAt).getTime(),
        });
        return;
      }
      timeoutId = setTimeout(tick, 5000);
    };
    tick();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [bulkRunId]);

  const onCancel = () =>
    startTransition(async () => {
      const response = await fetch(`/api/bulk-runs/${bulkRunId}/cancel`, {
        method: "POST",
      });
      const result = await response.json();
      if (result.success) {
        track("bulk.cancelled", {
          bulkRunId,
          cancelledCount: result.cancelledCount ?? 0,
        });
      } else {
        await notifyDialog({
          title: "Couldn't cancel",
          description: result.error ?? "Unknown error",
        });
      }
    });

  if (missing || !run) return null;
  const inFlight = !TERMINAL_STATUSES.has(run.status);
  const succeededItems = run.items.filter((it) => it.bulkStatus === "completed");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {getModelLabel(run.model)} · Bulk · {run.completed}/{run.total} done
          {run.failed > 0 ? ` · ${run.failed} failed` : ""}
          {run.cancelled > 0 ? ` · ${run.cancelled} cancelled` : ""}
        </span>
        <div className="flex gap-1">
          {inFlight && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide" : "Show"}
          </Button>
        </div>
      </div>
      {expanded && succeededItems.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {succeededItems.map((item) => {
            const entry: HistoryEntry = {
              id: item.id,
              type: "IMAGE",
              url: item.url ?? "",
              blobPath: null,
              width: null,
              height: null,
              prompt: item.prompt,
              boardId: run.boardId,
              nodeId: null,
              runGroupId: run.id,
              parentMediaId: null,
              source: "node",
              chatMessageId: null,
              pinned: false,
              errorMessage: item.errorMessage,
              modelSnapshot: null,
              createdAt: new Date(run.createdAt),
            };
            return (
              <MediaCard key={entry.id} entry={entry} className="aspect-square" />
            );
          })}
        </div>
      )}
    </div>
  );
}
