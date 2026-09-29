"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { SequenceCaptionToggles } from "./sequence-captions";
import { SequencePlayer } from "./sequence-player";
import { SequenceExport } from "./sequence-export";
import { SequenceVoicePicker } from "./sequence-voice";
import { SequenceTimeline } from "./sequence-timeline";
import { useSequenceMedia } from "./use-sequence-media";

export function SequencePanel({
  nodeId,
  open,
  onOpenChange,
}: {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[720px] max-w-full overflow-y-auto" data-testid={`sequence-panel-${nodeId}`}>
        <SheetHeader>
          <SheetTitle>Sequence</SheetTitle>
        </SheetHeader>
        {open && <SequencePanelBody nodeId={nodeId} />}
      </SheetContent>
    </Sheet>
  );
}

function SequencePanelBody({ nodeId }: { nodeId: string }) {
  const { data, mediaById, check, loadError } = useSequenceMedia(nodeId);
  const [batchRunning, setBatchRunning] = useState(false);
  return (
    <div className="flex flex-col gap-3 p-4">
      <SequenceVoicePicker nodeId={nodeId} data={data} mediaById={mediaById} onBatchChange={setBatchRunning} />
      <SequenceCaptionToggles nodeId={nodeId} data={data} />
      <SequencePlayer data={data} mediaById={mediaById} />
      <div className="text-xs" data-testid="sequence-check">
        {check.ok ? `${check.totalSeconds.toFixed(1)}s` : check.reason}
      </div>
      {loadError && <div className="text-xs text-red-600">{loadError}</div>}
      <SequenceTimeline nodeId={nodeId} items={data.items} mediaById={mediaById} voice={data.voice ?? null} batchRunning={batchRunning} />
      <SequenceExport nodeId={nodeId} data={data} mediaById={mediaById} check={check} />
    </div>
  );
}
