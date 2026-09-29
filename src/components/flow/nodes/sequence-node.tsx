"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import { Handle, Position, useNodeConnections } from "@xyflow/react";
import { ListVideo, Play } from "lucide-react";
import { Button } from "../../ui/button";
import { NodeBox } from "./node-box";
import { SequencePanel } from "../../sequence/sequence-panel";
import { useBoardStore } from "../../../stores/board-store";
import { downloadHref, shotLines, sourceMedia, syncSequenceItems } from "../../../lib/sequence/model";
import type { SequenceAspectRatio, SequenceNodeData } from "../../../lib/sequence/types";

const ASPECTS: SequenceAspectRatio[] = ["9:16", "16:9", "1:1", "4:5"];

interface SequenceNodeProps {
  id: string;
  data: SequenceNodeData & { onDelete?: (nodeId: string) => void };
  isConnectable?: boolean;
  selected?: boolean;
}

const SequenceNode = memo(({ id, data, isConnectable, selected }: SequenceNodeProps) => {
  const [panelOpen, setPanelOpen] = useState(false);
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const connections = useNodeConnections({ handleType: "target", handleId: "items" });
  const sourceKey = connections.map((connection) => connection.source).join("|");
  // Select the stable `nodes` array and derive sources in useMemo: a selector
  // that builds a new array on every call makes zustand re-render forever.
  const nodes = useBoardStore((state) => state.nodes);
  const sources = useMemo(
    () =>
      sourceKey
        .split("|")
        .filter(Boolean)
        .map((sourceId) => nodes.find((node) => node.id === sourceId))
        .filter((node): node is Node => node !== undefined),
    [nodes, sourceKey],
  );

  const edges = useBoardStore((state) => state.edges);
  const lines = useMemo(() => shotLines(nodes, edges), [nodes, edges]);
  const synced = useMemo(() => syncSequenceItems(data.items, sources, lines), [data.items, sources, lines]);
  useEffect(() => {
    if (JSON.stringify(synced) !== JSON.stringify(data.items)) updateNodeData(id, { items: synced });
  }, [data.items, id, synced, updateNodeData]);

  const thumbnails = synced.map((item) => {
    const source = sources.find((node) => node.id === item.sourceNodeId);
    return { item, media: source ? sourceMedia(source) : null };
  });

  return (
    <NodeBox
      id={id}
      title={data.label}
      icon={<ListVideo className="h-4 w-4 text-sky-500" />}
      nodeType="sequenceNode"
      onDelete={data.onDelete}
      isConnectable={isConnectable}
      selected={selected}
      minWidth="320px"
    >
      <Handle type="target" position={Position.Left} id="items" className="handle" />
      <div className="flex w-[300px] flex-col gap-2" data-testid="sequence-node">
        <div className="flex gap-1 overflow-x-auto" data-testid="sequence-strip">
          {thumbnails.length === 0 && (
            <div className="text-xs text-muted-foreground">Connect video or image nodes to build the cut.</div>
          )}
          {thumbnails.map(({ item, media }) => (
            <div key={item.sourceNodeId} className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
              {media?.kind === "video" && <video src={media.url} muted preload="metadata" className="h-full w-full object-cover" />}
              {media?.kind === "image" && <img src={media.url} alt="" className="h-full w-full object-cover" />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1" role="group" aria-label="Aspect ratio">
            {ASPECTS.map((aspect) => (
              <button
                key={aspect}
                type="button"
                data-testid={`sequence-aspect-${aspect}`}
                aria-pressed={data.aspectRatio === aspect}
                onClick={() => updateNodeData(id, { aspectRatio: aspect })}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${data.aspectRatio === aspect ? "border-primary bg-primary/10" : "text-muted-foreground"}`}
              >
                {aspect}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setPanelOpen(true)} data-testid="sequence-open-panel">
            <Play className="h-3.5 w-3.5" /> Edit & play
          </Button>
        </div>
        <div className="text-[11px] text-muted-foreground" data-testid="sequence-summary">
          {synced.length} item{synced.length === 1 ? "" : "s"}
        </div>
        {data.lastExport && (
          <a href={downloadHref(data.lastExport.url, "sequence.mp4")} download className="text-xs underline" data-testid="sequence-last-export">
            Download last export
          </a>
        )}
      </div>
      <SequencePanel nodeId={id} open={panelOpen} onOpenChange={setPanelOpen} />
    </NodeBox>
  );
});
SequenceNode.displayName = "SequenceNode";
export default SequenceNode;
