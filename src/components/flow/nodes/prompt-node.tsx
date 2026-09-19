"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Textarea } from "../../ui/textarea";
import { NodeBox } from "./node-box";
import { useReactFlow, Handle, Position } from "@xyflow/react";
import { useReadOnly } from "../readonly-context";

interface PromptNodeProps {
  id: string;
  data: {
    label: string;
    groupId?: string;
    onDelete?: (nodeId: string) => void;
    onSubmit?: (prompt: string, nodeId: string) => void;
    value?: string; // Store the prompt value in node data
    onCreateNode?: (nodeType: string) => void;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

const PromptNode = memo(
  ({ id, data, isConnectable, selected }: PromptNodeProps) => {
    // Use local state for UI but sync with node data (following React Flow guide)
    const [promptText, setPromptText] = useState(data.value || "");
    const { updateNodeData } = useReactFlow();
    const { isReadOnly } = useReadOnly();

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustTextareaHeight = useCallback(() => {
      if (textareaRef.current) {
        const MAX_HEIGHT = 240;
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(
          textareaRef.current.scrollHeight,
          MAX_HEIGHT,
        )}px`;
      }
    }, []);

    // Adjust height on mount and when value changes externally
    useEffect(() => {
      adjustTextareaHeight();
    }, [promptText, adjustTextareaHeight]);

    const handleTextChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = event.target.value;
        setPromptText(newValue);

        adjustTextareaHeight();

        // Store data inside the node's data object with updateNodeData (Step 1 from guide)
        updateNodeData(id, { value: newValue });
      },
      [id, updateNodeData, adjustTextareaHeight],
    );

    return (
      <NodeBox
        id={id}
        title="Prompt"
        icon={<MessageSquare className="h-4 w-4" />}
        isConnectable={isConnectable}
        onDelete={data.onDelete}
        minWidth="320px"
        nodeType="promptNode"
        onCreateNode={data.onCreateNode}
        selected={selected}
      >
        <div className="space-y-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="Enter your prompt here..."
              value={promptText}
              onChange={handleTextChange}
              className="nodrag nowheel slim-scrollbar min-h-[80px] max-h-[240px] overflow-y-auto shadow-none border-none resize-none bg-muted/30 focus:bg-background transition-colors focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isReadOnly}
            />
            <div
              className={`mt-1 px-3 text-[10px] tabular-nums ${
                promptText.length > 1000
                  ? "text-amber-600"
                  : promptText.length > 800
                    ? "text-amber-500"
                    : "text-muted-foreground"
              }`}
              title="Suggested prompt length — most video models work best around 1000 characters. Longer prompts are accepted but may be truncated by some models."
            >
              {promptText.length} / 1000 suggested
            </div>
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-muted-foreground/20 hover:!bg-primary"
        />
      </NodeBox>
    );
  },
);

PromptNode.displayName = "PromptNode";

export default PromptNode;
