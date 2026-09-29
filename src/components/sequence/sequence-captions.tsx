"use client";

import { Captions } from "lucide-react";
import { useBoardStore } from "../../stores/board-store";
import type { SequenceCaptions, SequenceNodeData } from "../../lib/sequence/types";

const LAYERS: Array<{ key: keyof SequenceCaptions; label: string; testId: string }> = [
  { key: "spoken", label: "Spoken words", testId: "sequence-captions-spoken" },
  { key: "onScreen", label: "On-screen text", testId: "sequence-captions-onscreen" },
];

export function SequenceCaptionToggles({ nodeId, data }: { nodeId: string; data: SequenceNodeData }) {
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  // Nodes saved before captions existed have both layers off.
  const captions = data.captions ?? { spoken: false, onScreen: false };
  return (
    <div className="flex items-center gap-2 text-xs" role="group" aria-label="Captions">
      <Captions className="h-3.5 w-3.5 text-muted-foreground" />
      <span>Captions</span>
      {LAYERS.map((layer) => (
        <button
          key={layer.key}
          type="button"
          data-testid={layer.testId}
          aria-pressed={captions[layer.key]}
          onClick={() => updateNodeData(nodeId, { captions: { ...captions, [layer.key]: !captions[layer.key] } })}
          className={`rounded-full border px-2 py-0.5 text-[11px] ${captions[layer.key] ? "border-primary bg-primary/10" : "text-muted-foreground"}`}
        >
          {layer.label}
        </button>
      ))}
    </div>
  );
}
