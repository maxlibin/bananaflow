"use client";

import { memo } from "react";
import { Eraser } from "lucide-react";
import { useBoardStore } from "../../../../stores/board-store";
import AdvancedOperationNode from "./advanced-operation-node";

interface RemoveBgNodeProps {
  id: string;
  data: {
    label?: string;
    resultUrl?: string;
    resultBlobPath?: string;
    resultSize?: number;
    onDelete?: (nodeId: string) => void;
    onCreateNode?: (nodeType: string) => void;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

const RemoveBgNode = memo(
  ({ id, data, isConnectable, selected }: RemoveBgNodeProps) => {
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
        label="Remove Background"
        nodeType="removeBgNode"
        icon={<Eraser className="h-4 w-4" />}
        op="remove_bg"
        feature="BACKGROUND_REMOVAL"
        apiPath="/api/remove-bg"
        resultUrl={data.resultUrl}
        resultBlobPath={data.resultBlobPath}
        resultSize={data.resultSize}
        onDelete={data.onDelete}
        onCreateNode={data.onCreateNode}
        validationError={imageUrl ? null : "Connect an image."}
        buildPayload={() => {
          if (!imageUrl) return null;
          return { imageUrl };
        }}
      />
    );
  }
);

RemoveBgNode.displayName = "RemoveBgNode";
export default RemoveBgNode;
