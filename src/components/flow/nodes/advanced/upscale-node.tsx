"use client";

import { memo, useState } from "react";
import { Maximize2 } from "lucide-react";
import { useBoardStore } from "../../../../stores/board-store";
import AdvancedOperationNode from "./advanced-operation-node";

interface UpscaleNodeProps {
  id: string;
  data: {
    label?: string;
    factor?: 2 | 4;
    resultUrl?: string;
    resultBlobPath?: string;
    resultSize?: number;
    onDelete?: (nodeId: string) => void;
    onCreateNode?: (nodeType: string) => void;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

const UpscaleNode = memo(
  ({ id, data, isConnectable, selected }: UpscaleNodeProps) => {
    const [factor, setFactor] = useState<2 | 4>(data.factor ?? 2);

    const edges = useBoardStore((state) => state.edges);
    const nodes = useBoardStore((state) => state.nodes);
    const incomingEdge = edges.find((e) => e.target === id);
    const sourceNode = incomingEdge
      ? nodes.find((n) => n.id === incomingEdge.source)
      : undefined;
    const sourceData = sourceNode?.data as
      | { imageUrl?: string; resultUrl?: string }
      | undefined;
    const imageUrl = sourceData?.imageUrl ?? sourceData?.resultUrl;

    return (
      <AdvancedOperationNode
        id={id}
        selected={selected}
        isConnectable={isConnectable}
        label={`Upscale ${factor}x`}
        nodeType="upscaleNode"
        icon={<Maximize2 className="h-4 w-4" />}
        op={factor === 4 ? "upscale_4x" : "upscale_2x"}
        feature="IMAGE_UPSCALE"
        apiPath="/api/upscale"
        resultUrl={data.resultUrl}
        resultBlobPath={data.resultBlobPath}
        resultSize={data.resultSize}
        onDelete={data.onDelete}
        onCreateNode={data.onCreateNode}
        validationError={imageUrl ? null : "Connect an image to upscale."}
        renderSettings={() => (
          <div className="flex gap-1">
            {[2, 4].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFactor(f as 2 | 4)}
                className={`px-2 py-1 text-xs rounded border ${
                  factor === f ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {f}x
              </button>
            ))}
          </div>
        )}
        buildPayload={() => {
          if (!imageUrl) return null;
          return { imageUrl, factor };
        }}
      />
    );
  }
);

UpscaleNode.displayName = "UpscaleNode";
export default UpscaleNode;
