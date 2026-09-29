"use client";

import { ControlButton, useViewport } from "@xyflow/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";
import {
  FileText,
  MessageSquare,
  Square,
  Video,
  Film,
  Maximize2,
  Eraser,
  User,
  ListVideo,
} from "lucide-react";
import { useBoardStore } from "../../../stores/board-store";

export default function FlowControls() {
  const viewport = useViewport();
  const addInputNode = useBoardStore((state) => state.addInputNode);
  const addScriptNode = useBoardStore((state) => state.addScriptNode);
  const addSequenceNode = useBoardStore((state) => state.addSequenceNode);
  const addOutputNode = useBoardStore((state) => state.addOutputNode);
  const addVideoNode = useBoardStore((state) => state.addVideoNode);
  const addSeedNode = useBoardStore((state) => state.addSeedNode);
  const addUpscaleNode = useBoardStore((state) => state.addUpscaleNode);
  const addRemoveBgNode = useBoardStore((state) => state.addRemoveBgNode);
  const addFaceConsistencyNode = useBoardStore(
    (state) => state.addFaceConsistencyNode
  );

  return (
    <TooltipProvider>
      {/*
        xyflow's `.react-flow__controls-button svg` sets `fill: currentColor`,
        which fills lucide icons (designed as stroke-only outlines) into solid
        blobs — the Image and Type icons are the worst offenders. Override
        back to stroke-only here.
      */}
      <div className="controls-addon flex flex-col order-first border-b [&_svg]:!fill-none [&_svg]:!stroke-current">
        <Tooltip>
          <TooltipTrigger asChild>
            <ControlButton onClick={() => addScriptNode(viewport)} data-testid="add-script-node">
              <FileText className="h-4 w-4" />
            </ControlButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Add Script Node (write the story, then break it into shots)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ControlButton onClick={() => addSequenceNode(viewport)} data-testid="add-sequence-node">
              <ListVideo className="h-4 w-4" />
            </ControlButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Add Sequence Node (put clips in order and export an MP4)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ControlButton onClick={() => addInputNode(viewport)}>
              <MessageSquare className="h-4 w-4" />
            </ControlButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Add Input Node (prompt + images)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ControlButton onClick={() => addOutputNode(viewport)}>
              <Square className="h-4 w-4" />
            </ControlButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Add Image Generator Node</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ControlButton onClick={() => addVideoNode(viewport)}>
              <Video className="h-4 w-4" />
            </ControlButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Add Video Generator Node</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ControlButton onClick={() => addSeedNode(viewport)}>
              <Film className="h-4 w-4" />
            </ControlButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Add Seed Frame Node</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-px bg-border my-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <ControlButton onClick={() => addUpscaleNode(viewport)}>
              <Maximize2 className="h-4 w-4" />
            </ControlButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Upscale Node</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ControlButton onClick={() => addRemoveBgNode(viewport)}>
              <Eraser className="h-4 w-4" />
            </ControlButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Remove Background</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ControlButton onClick={() => addFaceConsistencyNode(viewport)}>
              <User className="h-4 w-4" />
            </ControlButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Face Consistency</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
