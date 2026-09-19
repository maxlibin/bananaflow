"use client";

import { memo } from "react";
import { User } from "lucide-react";
import { useBoardStore } from "../../../../stores/board-store";
import AdvancedOperationNode from "./advanced-operation-node";

interface FaceConsistencyNodeProps {
  id: string;
  data: {
    label?: string;
    aspectRatio?: string;
    resultUrl?: string;
    resultBlobPath?: string;
    resultSize?: number;
    onDelete?: (nodeId: string) => void;
    onCreateNode?: (nodeType: string) => void;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

const FaceConsistencyNode = memo(
  ({ id, data, isConnectable, selected }: FaceConsistencyNodeProps) => {
    const edges = useBoardStore((state) => state.edges);
    const nodes = useBoardStore((state) => state.nodes);

    const inputEdge = edges.find(
      (e) => e.target === id && e.targetHandle === "input"
    );
    const inputNode = inputEdge
      ? nodes.find((n) => n.id === inputEdge.source)
      : undefined;
    const inputData = inputNode?.data as
      | {
          value?: string;
          images?: Array<{ imageUrl: string }>;
        }
      | undefined;

    const faceEdge = edges.find(
      (e) => e.target === id && e.targetHandle === "images"
    );
    const promptEdge = edges.find(
      (e) => e.target === id && e.targetHandle === "prompt"
    );
    const faceNode = faceEdge
      ? nodes.find((n) => n.id === faceEdge.source)
      : undefined;
    const promptNode = promptEdge
      ? nodes.find((n) => n.id === promptEdge.source)
      : undefined;

    const faceData = faceNode?.data as
      | { imageUrl?: string; resultUrl?: string }
      | undefined;

    const referenceImageUrl =
      inputData?.images?.[0]?.imageUrl ??
      faceData?.imageUrl ??
      faceData?.resultUrl;
    const prompt = (
      inputData?.value ??
      (promptNode?.data as { value?: string } | undefined)?.value
    )?.trim();

    const validationError = !referenceImageUrl
      ? "Connect a face reference image."
      : !prompt
        ? "Connect a Prompt node describing the scene."
        : null;

    return (
      <AdvancedOperationNode
        id={id}
        selected={selected}
        isConnectable={isConnectable}
        label="Face Consistency"
        nodeType="faceConsistencyNode"
        icon={<User className="h-4 w-4" />}
        op="face_consistency"
        feature="FACE_CONSISTENCY"
        apiPath="/api/face-consistency"
        resultUrl={data.resultUrl}
        resultBlobPath={data.resultBlobPath}
        resultSize={data.resultSize}
        onDelete={data.onDelete}
        onCreateNode={data.onCreateNode}
        validationError={validationError}
        extraInputHandleId="prompt"
        withInputHandle={true}
        buildPayload={() => {
          if (!referenceImageUrl || !prompt) return null;
          return {
            prompt,
            referenceImageUrl,
            aspectRatio: data.aspectRatio,
          };
        }}
      />
    );
  }
);

FaceConsistencyNode.displayName = "FaceConsistencyNode";
export default FaceConsistencyNode;
