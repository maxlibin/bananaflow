"use client";

import { memo, useState, type ReactNode } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import NextImage from "next/image";
import { Button } from "../../../ui/button";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { NodeBox } from "../node-box";
import { useReadOnly } from "../../readonly-context";
import { useBoardStore } from "../../../../stores/board-store";
import { useCanvasHost } from "../../../canvas-host/context";
import type { AdvancedOpId } from "../../../../lib/advanced-ops";
import type { GenerationFeature } from "../../../../lib/host/features";

export interface AdvancedOperationNodeProps {
  id: string;
  selected?: boolean;
  isConnectable?: boolean;
  label: string;
  nodeType: string;
  icon: ReactNode;
  op: AdvancedOpId;
  feature: GenerationFeature;
  apiPath: string;
  resultUrl?: string;
  resultBlobPath?: string;
  resultSize?: number;
  onDelete?: (nodeId: string) => void;
  renderSettings?: () => ReactNode;
  buildPayload: () => Record<string, unknown> | null;
  validationError?: string | null;
  extraInputHandleId?: string;
  withInputHandle?: boolean;
  onCreateNode?: (nodeType: string) => void;
}

const AdvancedOperationNodeInner = (props: AdvancedOperationNodeProps) => {
  const { updateNodeData } = useReactFlow();
  const { isReadOnly } = useReadOnly();
  const boardId = useBoardStore((state) => state.boardId);

  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const canvasHost = useCanvasHost();
  const estimatedCost = canvasHost.costPreview({ kind: "advanced", op: props.op });

  const run = async () => {
    if (isRunning || isReadOnly) return;
    if (!boardId) {
      setRunError("Board not ready");
      return;
    }
    const extras = props.buildPayload();
    if (!extras) return;

    setRunError(null);
    setIsRunning(true);
    const controller = new AbortController();

    try {
      const res = await fetch(props.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          previousBlobPath: props.resultBlobPath,
          previousSize: props.resultSize ?? 0,
          ...extras,
        }),
        signal: controller.signal,
      });

      const payload = (await res.json()) as {
        success?: boolean;
        error?: string;
        upgradeRequired?: boolean;
        feature?: GenerationFeature;
        resultUrl?: string;
        blobPath?: string;
        sizeBytes?: number;
      };

      if (!res.ok || !payload.success) {
        if (
          (res.status === 402 || res.status === 403 || res.status === 429) &&
          payload.upgradeRequired
        ) {
          canvasHost.onLimit({
            feature: payload.feature ?? props.feature,
            kind: res.status === 402 ? "out_of_credits" : "rate_limit",
            severity: "warning",
            message: payload.error ?? "Upgrade required to run this node.",
            plan: null,
          });
        }
        setRunError(payload.error ?? `Failed (${res.status})`);
        return;
      }

      updateNodeData(props.id, {
        resultUrl: payload.resultUrl,
        resultBlobPath: payload.blobPath,
        resultSize: payload.sizeBytes,
      });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Run failed");
    } finally {
      setIsRunning(false);
    }
  };

  const disabled = isReadOnly || isRunning || Boolean(props.validationError);

  return (
    <NodeBox
      id={props.id}
      title={props.label}
      icon={props.icon}
      isConnectable={props.isConnectable}
      onDelete={props.onDelete}
      minWidth="280px"
      nodeType={props.nodeType}
      onCreateNode={props.onCreateNode}
      selected={props.selected}
    >
      {props.withInputHandle && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{ top: 0 }}
        />
      )}
      <Handle
        type="target"
        position={Position.Left}
        id="images"
        style={{ top: 40 }}
      />
      {props.extraInputHandleId && (
        <Handle
          type="target"
          position={Position.Left}
          id={props.extraInputHandleId}
          style={{ top: 80 }}
        />
      )}

      <div className="space-y-2">
        {props.renderSettings?.()}

        {props.resultUrl && (
          <div className="rounded overflow-hidden border">
            <NextImage
              src={props.resultUrl}
              alt={props.label}
              width={280}
              height={280}
              className="w-full object-contain"
            />
          </div>
        )}

        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={run}
              disabled={disabled}
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Running...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Run{estimatedCost ? ` · ${estimatedCost.credits} cr` : ""}
                </>
              )}
            </Button>
          </div>
        )}

        {props.validationError && !isRunning && (
          <p className="text-[10px] text-muted-foreground">
            {props.validationError}
          </p>
        )}

        {runError && (
          <p className="text-[10px] text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {runError}
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </NodeBox>
  );
};

const AdvancedOperationNode = memo(AdvancedOperationNodeInner);
AdvancedOperationNode.displayName = "AdvancedOperationNode";
export default AdvancedOperationNode;
