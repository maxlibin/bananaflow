"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useBoardStore } from "../../stores/board-store";
import { InvalidSequenceEditError, moveItem, setHold, setTrim } from "../../lib/sequence/model";
import type { SequenceItem, SequenceMedia } from "../../lib/sequence/types";

// Keeps what the user is typing and applies it on Enter or blur, so
// intermediate values ("2" on the way to "2.5") are not rejected.
function SecondsField({
  value,
  step,
  disabled,
  testId,
  onCommit,
}: {
  value: number | "";
  step: number;
  disabled: boolean;
  testId: string;
  onCommit: (seconds: number) => boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    if (draft === String(value)) return;
    if (!onCommit(Number(draft))) setDraft(String(value));
  };
  return (
    <Input
      type="number"
      step={step}
      className="h-7 w-20"
      value={draft}
      disabled={disabled}
      data-testid={testId}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}

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

  const apply = (edit: () => SequenceItem[]): boolean => {
    try {
      updateNodeData(nodeId, { items: edit() });
      setError(null);
      return true;
    } catch (caught) {
      if (!(caught instanceof InvalidSequenceEditError)) throw caught;
      setError(caught.message);
      return false;
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
                <SecondsField
                  value={item.trimStart}
                  step={0.1}
                  disabled={clipSeconds === null}
                  testId={`sequence-trim-start-${index}`}
                  onCommit={(seconds) => apply(() => setTrim(items, index, seconds, item.trimEnd, clipSeconds as number))}
                />
                <span>to</span>
                <SecondsField
                  value={item.trimEnd ?? clipSeconds ?? ""}
                  step={0.1}
                  disabled={clipSeconds === null}
                  testId={`sequence-trim-end-${index}`}
                  onCommit={(seconds) => apply(() => setTrim(items, index, item.trimStart, seconds, clipSeconds as number))}
                />
                <span className="text-muted-foreground">{clipSeconds === null ? "loading…" : `of ${clipSeconds.toFixed(1)}s`}</span>
              </>
            ) : (
              <>
                <span>Still for</span>
                <SecondsField
                  value={item.holdSeconds}
                  step={0.5}
                  disabled={false}
                  testId={`sequence-hold-${index}`}
                  onCommit={(seconds) => apply(() => setHold(items, index, seconds))}
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
