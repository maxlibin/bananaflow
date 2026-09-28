"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useBoardStore } from "../../stores/board-store";
import { InvalidSequenceEditError, moveItem, setHold, setTrim } from "../../lib/sequence/model";
import type { SequenceItem, SequenceMedia } from "../../lib/sequence/types";

export function SequenceTimeline({
  nodeId,
  items,
  mediaById,
}: {
  nodeId: string;
  items: SequenceItem[];
  mediaById: Record<string, SequenceMedia | null>;
}) {
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const removeEdgesByConnection = useBoardStore((state) => state.removeEdgesByConnection);
  const [error, setError] = useState<string | null>(null);

  const apply = (edit: () => SequenceItem[]) => {
    try {
      updateNodeData(nodeId, { items: edit() });
      setError(null);
    } catch (caught) {
      if (!(caught instanceof InvalidSequenceEditError)) throw caught;
      setError(caught.message);
    }
  };

  return (
    <div className="flex flex-col gap-1" data-testid="sequence-timeline">
      {items.map((item, index) => {
        const media = mediaById[item.sourceNodeId];
        const clipSeconds = media?.kind === "video" ? media.seconds : null;
        return (
          <div key={item.sourceNodeId} className="flex items-center gap-2 rounded border p-1.5 text-xs" data-testid={`sequence-item-${index}`}>
            <span className="w-5 text-muted-foreground">{index + 1}</span>
            <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => apply(() => moveItem(items, index, index - 1))} aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" disabled={index === items.length - 1} onClick={() => apply(() => moveItem(items, index, index + 1))} aria-label="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            {item.kind === "video" ? (
              <>
                <span>Clip</span>
                <Input
                  type="number"
                  step={0.1}
                  className="h-7 w-20"
                  value={item.trimStart}
                  disabled={clipSeconds === null}
                  data-testid={`sequence-trim-start-${index}`}
                  onChange={(event) => apply(() => setTrim(items, index, Number(event.target.value), item.trimEnd, clipSeconds as number))}
                />
                <span>to</span>
                <Input
                  type="number"
                  step={0.1}
                  className="h-7 w-20"
                  value={item.trimEnd ?? clipSeconds ?? ""}
                  disabled={clipSeconds === null}
                  data-testid={`sequence-trim-end-${index}`}
                  onChange={(event) => apply(() => setTrim(items, index, item.trimStart, Number(event.target.value), clipSeconds as number))}
                />
                <span className="text-muted-foreground">{clipSeconds === null ? "loading…" : `of ${clipSeconds.toFixed(1)}s`}</span>
              </>
            ) : (
              <>
                <span>Still for</span>
                <Input
                  type="number"
                  step={0.5}
                  className="h-7 w-20"
                  value={item.holdSeconds}
                  data-testid={`sequence-hold-${index}`}
                  onChange={(event) => apply(() => setHold(items, index, Number(event.target.value)))}
                />
                <span>s</span>
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto"
              aria-label="Remove from sequence"
              data-testid={`sequence-remove-${index}`}
              onClick={() => removeEdgesByConnection({ source: item.sourceNodeId, target: nodeId, targetHandle: "items" })}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
      {error && <div className="text-xs text-red-600" data-testid="sequence-edit-error">{error}</div>}
    </div>
  );
}
