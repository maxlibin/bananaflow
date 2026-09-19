"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Connection,
  Edge,
} from "@xyflow/react";
import type { Node as FlowNode } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useShallow } from "zustand/react/shallow";
import { BoardStoreProvider, useBoardStore } from "../../stores/board-store";
import {
  ImageNode,
  InputNode,
  PromptNode,
  OutputNode,
  VideoNode,
  SeedNode,
  UpscaleNode,
  RemoveBgNode,
  FaceConsistencyNode,
} from "./nodes";
import { FlowControls } from "./controls";
import { ReadOnlyProvider } from "./readonly-context";
import { useTheme } from "../app-theme-provider";
import { MediaPanel } from "./media-panel";
import { HistoryPanel } from "./history-panel";

const nodeTypes = {
  imageNode: ImageNode,
  inputNode: InputNode,
  promptNode: PromptNode,
  outputNode: OutputNode,
  videoNode: VideoNode,
  seedNode: SeedNode,
  upscaleNode: UpscaleNode,
  removeBgNode: RemoveBgNode,
  faceConsistencyNode: FaceConsistencyNode,
};

interface FlowContainerProps {
  boardId?: string;
  initialNodes?: FlowNode[];
  initialEdges?: Edge[];
  isReadOnly?: boolean;
}

export function FlowCanvas({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const nodes = useBoardStore(useShallow((state) => state.nodes));
  const edges = useBoardStore(useShallow((state) => state.edges));
  const handleNodesChange = useBoardStore((state) => state.handleNodesChange);
  const handleEdgesChange = useBoardStore((state) => state.handleEdgesChange);
  const handleConnect = useBoardStore((state) => state.handleConnect);
  const setReactFlowInstance = useBoardStore(
    (state) => state.setReactFlowInstance,
  );
  const fitView = useBoardStore((state) => state.fitView);
  const { resolvedTheme } = useTheme();

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.targetHandle) {
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);

        if (
          targetNode?.type === "outputNode" ||
          targetNode?.type === "videoNode" ||
          targetNode?.type === "faceConsistencyNode"
        ) {
          if (sourceNode?.type === "inputNode") {
            connection.targetHandle = "input";
          } else if (sourceNode?.type === "promptNode") {
            connection.targetHandle = "prompt";
          } else {
            connection.targetHandle = "images";
          }
        } else if (
          sourceNode?.type === "imageNode" ||
          sourceNode?.type === "outputNode" ||
          sourceNode?.type === "videoNode" ||
          sourceNode?.type === "seedNode" ||
          sourceNode?.type === "upscaleNode" ||
          sourceNode?.type === "removeBgNode" ||
          sourceNode?.type === "faceConsistencyNode"
        ) {
          connection.targetHandle = "images";
        } else if (sourceNode?.type === "promptNode") {
          connection.targetHandle = "prompt";
        } else if (sourceNode?.type === "inputNode") {
          // inputNode connecting to a non-output node (seed/upscale/removeBg)
          // — only its images are usable. Route through 'images' handle.
          connection.targetHandle = "images";
        }
      }

      if (connection.targetHandle === "images") {
        return true;
      }

      return true;
    },
    [nodes],
  );

  return (
    <ReadOnlyProvider isReadOnly={isReadOnly}>
      <div className="relative w-full h-full overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={isReadOnly ? undefined : handleNodesChange}
          onEdgesChange={isReadOnly ? undefined : handleEdgesChange}
          onConnect={isReadOnly ? undefined : handleConnect}
          nodesDraggable={!isReadOnly}
          nodesConnectable={!isReadOnly}
          nodesFocusable={!isReadOnly}
          elementsSelectable={!isReadOnly}
          selectNodesOnDrag={false}
          deleteKeyCode={isReadOnly ? null : "Delete"}
          onInit={(instance) => {
            setReactFlowInstance(instance);
            window.setTimeout(() => fitView(), 100);
          }}
          isValidConnection={isValidConnection}
          proOptions={{ hideAttribution: true }}
          colorMode={resolvedTheme}
          fitView
        >
          <Controls
            position="center-left"
            showInteractive={false}
            className="!bg-white dark:!bg-zinc-900 !border !border-zinc-200 dark:!border-zinc-800 overflow-hidden p-2 !shadow-none !rounded-3xl"
          >
            {!isReadOnly && <FlowControls />}
          </Controls>
        </ReactFlow>
        {!isReadOnly && <MediaPanel />}
        {!isReadOnly && <HistoryPanel />}
      </div>
    </ReadOnlyProvider>
  );
}

export default function FlowContainer({
  boardId,
  initialNodes,
  initialEdges,
  isReadOnly = false,
}: FlowContainerProps = {}) {
  return (
    <BoardStoreProvider
      boardId={boardId}
      initialNodes={initialNodes}
      initialEdges={initialEdges}
    >
      <FlowCanvas isReadOnly={isReadOnly} />
    </BoardStoreProvider>
  );
}
