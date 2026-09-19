"use client";

import { useEffect, useState } from "react";
import { expandWildcards } from "../../lib/bulk-wildcards";
import { BULK_MAX_EXPANSION } from "../../lib/bulk-limits";
import { useCanvasHost } from "../canvas-host/context";

type WildcardChipProps = {
  prompt: string;
  model: string;
};

export function WildcardChip({ prompt, model }: WildcardChipProps) {
  const canvasHost = useCanvasHost();
  const [state, setState] = useState<{
    count: number;
    truncated: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!prompt || !prompt.includes("{")) {
      setState(null);
      return;
    }
    const handle = setTimeout(() => {
      try {
        const r = expandWildcards(prompt, BULK_MAX_EXPANSION);
        setState({ count: r.count, truncated: r.truncated });
      } catch (err) {
        setState({
          count: 0,
          truncated: false,
          error: err instanceof Error ? err.message : "Invalid wildcard syntax",
        });
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [prompt]);

  if (!state) return null;
  if (state.error) {
    return <div className="text-[11px] text-destructive">{state.error}</div>;
  }
  if (state.count <= 1) return null;

  const cost = canvasHost.costPreview({ kind: "bulk", model, count: state.count });
  return (
    <div className="text-[11px] text-muted-foreground">
      → {state.count} prompts{cost ? ` · ${cost.credits} credits` : ""}
      {state.truncated ? " (truncated)" : ""}
    </div>
  );
}
