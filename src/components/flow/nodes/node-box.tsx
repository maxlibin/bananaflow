"use client";

import { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { Button } from "../../ui/button";
import { Trash2, Plus } from "lucide-react";
import { useReadOnly } from "../readonly-context";
import { cn } from "../../../lib/utils";

interface NodeBoxProps {
  id: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
  isConnectable?: boolean;
  onDelete?: (nodeId: string) => void;
  headerActions?: ReactNode;
  minWidth?: string;
  nodeType?: string;
  onCreateNode?: (nodeType: string) => void;
  selected?: boolean;
  className?: string;
  targetHandleId?: string;
}

export const NodeBox = ({
  id,
  title,
  icon,
  children,
  isConnectable = true,
  onDelete,
  headerActions,
  minWidth = "280px",
  nodeType,
  onCreateNode,
  selected,
  className,
  targetHandleId,
}: NodeBoxProps) => {
  const { isReadOnly } = useReadOnly();
  const accents = {
    imageNode: {
      dot: "bg-amber-500",
      handle: "bg-amber-400",
      border: "border-amber-300",
      selectedBorder: "border-amber-500/70",
    },
    promptNode: {
      dot: "bg-sky-500",
      handle: "bg-sky-400",
      border: "border-sky-300",
      selectedBorder: "border-sky-500/70",
    },
    inputNode: {
      dot: "bg-emerald-500",
      handle: "bg-emerald-400",
      border: "border-emerald-300",
      selectedBorder: "border-emerald-500/70",
    },
    outputNode: {
      dot: "bg-orange-500",
      handle: "bg-orange-400",
      border: "border-orange-300",
      selectedBorder: "border-orange-500/70",
    },
    videoNode: {
      dot: "bg-violet-500",
      handle: "bg-violet-400",
      border: "border-violet-300",
      selectedBorder: "border-violet-500/70",
    },
    seedNode: {
      dot: "bg-pink-500",
      handle: "bg-pink-400",
      border: "border-pink-300",
      selectedBorder: "border-pink-500/70",
    },
    default: {
      dot: "bg-primary",
      handle: "bg-primary",
      border: "border-border",
      selectedBorder: "border-border",
    },
  } as const;

  const accent =
    (nodeType && nodeType in accents
      ? accents[nodeType as keyof typeof accents]
      : accents.default) ?? accents.default;

  return (
    <div
      className={cn(
        "relative group transition-colors duration-200",
        selected ? "z-10" : "z-0",
      )}
      style={{ minWidth }}
    >
      {/* Header (outside the box, no background) */}
      <div className="flex justify-between items-center px-1 pb-1.5">
        <div className="text-sm font-semibold text-foreground/80 flex items-center gap-2.5">
          <span className={cn("h-2 w-2 rounded-full", accent.dot)} />
          {icon}
          <span>{title}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {headerActions}
          {onDelete && !isReadOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 shadow-none text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "relative bg-white dark:bg-zinc-900/90 rounded-md border",
          selected
            ? accent.selectedBorder
            : cn("border-border/80", accent.border),
          "p-0 overflow-hidden max-w-[320px]",
          className,
        )}
      >
        <Handle
          type="target"
          position={Position.Left}
          id={targetHandleId}
          isConnectable={isConnectable && !isReadOnly}
          className={cn(
            "!w-3.5 !h-3.5 !-left-1.5 border-2 border-background transition-transform hover:scale-125 cursor-crosshair hover:!w-4 hover:!h-4",
            accent.handle,
          )}
        />

        {/* Content */}
        <div className="p-2">{children}</div>

        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable && !isReadOnly}
          className={cn(
            "!w-3.5 !h-3.5 !-right-1.5 border-2 border-background transition-transform hover:scale-125 cursor-crosshair hover:!w-4 hover:!h-4",
            accent.handle,
          )}
        />
      </div>

      {/* Plus icon that appears on hover */}
      {nodeType && onCreateNode && !isReadOnly && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-75 hover:scale-110">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 rounded-full p-0 bg-background border-border hover:border-primary/50 text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onCreateNode(nodeType);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default NodeBox;
