"use client";

import { memo, useState } from "react";
import { FileText, Pencil } from "lucide-react";
import { Button } from "../../ui/button";
import { NodeBox } from "./node-box";
import { ScriptPanel } from "../../script/script-panel";
import { extractScenes } from "../../../lib/script/scenes";
import { estimateScriptTiming } from "../../../lib/script/timing";
import type { ScriptNodeData } from "../../../lib/script/types";
import { cn } from "../../../lib/utils";

interface ScriptNodeProps {
  id: string;
  data: ScriptNodeData & {
    onDelete?: (nodeId: string) => void;
    onCreateNode?: (nodeType: string) => void;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

const ScriptNode = memo(({ id, data, isConnectable, selected }: ScriptNodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const scenes = extractScenes(data.doc);
  const timing = estimateScriptTiming(scenes, data.targetDuration);

  return (
    <NodeBox
      id={id}
      title="Script"
      icon={<FileText className="h-4 w-4 text-indigo-500" />}
      nodeType="scriptNode"
      onDelete={data.onDelete}
      isConnectable={isConnectable}
      selected={selected}
      minWidth="300px"
    >
      <div className="flex w-[280px] flex-col gap-2" data-testid="script-node">
        <div>
          <div className="text-sm font-semibold leading-tight">{data.title}</div>
          {data.logline && (
            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{data.logline}</div>
          )}
        </div>
        <ol className="space-y-0.5">
          {scenes.map((scene, index) => (
            <li key={scene.sceneId} className="flex justify-between gap-2 text-[11px]">
              <span className="truncate">
                {index + 1}. {scene.heading || "Untitled scene"}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {timing.scenes[index].seconds}s
              </span>
            </li>
          ))}
        </ol>
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-[11px] font-medium",
              timing.overTarget ? "text-red-600" : "text-muted-foreground",
            )}
          >
            {timing.totalSeconds}s / {data.targetDuration}s
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs nodrag"
            onClick={(event) => {
              event.stopPropagation();
              setIsEditing(true);
            }}
            data-testid="script-node-edit"
          >
            <Pencil className="h-3 w-3" /> Edit script
          </Button>
        </div>
      </div>
      {isEditing && (
        <ScriptPanel nodeId={id} open={isEditing} onOpenChange={setIsEditing} />
      )}
    </NodeBox>
  );
});

ScriptNode.displayName = "ScriptNode";

export default ScriptNode;
