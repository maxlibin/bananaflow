"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Handle, Position, useNodeConnections } from "@xyflow/react";
import NextImage from "next/image";
import { Button } from "../../ui/button";
import { Progress } from "../../ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Slider } from "../../ui/slider";
import { ModelCombobox } from "../model-combobox";
import { NodeBox } from "./node-box";
import {
  Video,
  MessageSquare,
  Download,
  Pin,
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import {
  DEFAULT_VIDEO_MODEL_SETTINGS,

  type VideoModelSettings,
} from "../../../lib/video-models";
import { useBoardStore } from "../../../stores/board-store";
import { useCanvasHost } from "../../canvas-host/context";

function CustomHandle({
  id,
  label,
  onChange,
  hidden = false,
}: {
  id: string;
  label: string;
  onChange: (connectedIds: string[]) => void;
  hidden?: boolean;
}) {
  const connections = useNodeConnections({
    handleType: "target",
    handleId: id,
  });

  const connectedNodeIds =
    connections?.map((conn) => conn.source).filter(Boolean) ?? [];
  const prevIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const prevIds = prevIdsRef.current;
    const sameLength = prevIds.length === connectedNodeIds.length;
    const sameValues = sameLength
      ? prevIds.every((value, index) => value === connectedNodeIds[index])
      : false;

    if (!sameLength || !sameValues) {
      prevIdsRef.current = connectedNodeIds;
      onChange(connectedNodeIds);
    }
  }, [connectedNodeIds, onChange]);

  return (
    <div style={hidden ? { display: "none" } : undefined}>
      <Handle
        type="target"
        position={Position.Left}
        id={id}
        className="handle"
      />
      <label htmlFor={id} className="label text-xs text-muted-foreground">
        {label}
      </label>
    </div>
  );
}

interface VideoNodeProps {
  id: string;
  data: {
    label: string;
    result?: {
      status?: "generating" | "completed" | "error";
      videoUrl?: string;
      prompt?: string;
      error?: string;
      model?: string;
      runGroupId?: string | null;
      mediaIds?: string[];
    };
    runGroupId?: string | null;
    mediaIds?: string[];
    onDelete?: () => void;
    onGenerate?: (
      nodeId: string,
      connectedData?: {
        prompt?: string;
        images?: Array<{
          nodeId: string;
          imageUrl: string;
          fileName?: string;
          blobPath?: string;
        }>;
        model?: string;
        settings?: Partial<VideoModelSettings>;
      }
    ) => void;
    onCancelGenerate?: (nodeId: string) => void;
    onCreateNode?: (nodeType: string) => void;
    selectedModel?: string;
    modelSettings?: Partial<VideoModelSettings>;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

function VideoNode({ id, data, isConnectable, selected }: VideoNodeProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasHost = useCanvasHost();
  const availableModels = canvasHost.models.video;
  const defaultModel = availableModels[0]?.value ?? "";
  const [selectedModel, setSelectedModel] = useState(
    typeof data.selectedModel === "string" ? data.selectedModel : defaultModel
  );
  const [imageConnectionIds, setImageConnectionIds] = useState<string[]>([]);
  const [promptConnectionIds, setPromptConnectionIds] = useState<string[]>([]);
  const [inputConnectionIds, setInputConnectionIds] = useState<string[]>([]);
  const [modelSettings, setModelSettings] = useState<VideoModelSettings>(() => {
    const savedSettings =
      data.modelSettings && typeof data.modelSettings === "object"
        ? (data.modelSettings as Record<string, unknown>)
        : {};

    return {
      ...DEFAULT_VIDEO_MODEL_SETTINGS,
      ...(savedSettings as Partial<VideoModelSettings>),
    };
  });

  const [connectedData, setConnectedData] = useState<{
    images: Array<{
      nodeId: string;
      imageUrl: string;
      fileName?: string;
      blobPath?: string;
    }>;
    prompt: string;
  }>({
    images: [],
    prompt: "",
  });

  // If `data.result` was cleared but the per-field outputs (videoUrl,
  // fileName, runGroupId, mediaIds) survived on the node data, reconstruct
  // a synthetic completed result so the preview reappears. Covers nodes
  // that lost their result via earlier buggy code paths.
  const dataAsRecord = (data ?? {}) as Record<string, unknown>;
  const surviving: typeof data.result | undefined =
    !data.result && typeof dataAsRecord.videoUrl === "string"
      ? {
          status: "completed",
          videoUrl: dataAsRecord.videoUrl as string,
          prompt:
            typeof dataAsRecord.prompt === "string"
              ? (dataAsRecord.prompt as string)
              : undefined,
          runGroupId:
            typeof dataAsRecord.runGroupId === "string"
              ? (dataAsRecord.runGroupId as string)
              : null,
          mediaIds: Array.isArray(dataAsRecord.mediaIds)
            ? (dataAsRecord.mediaIds as string[])
            : [],
        }
      : undefined;
  const generatedResult = data.result ?? surviving;
  const generatedMediaIds: string[] = Array.isArray(data.mediaIds)
    ? data.mediaIds
    : Array.isArray(generatedResult?.mediaIds)
      ? (generatedResult.mediaIds as string[])
      : [];
  const [pinnedMediaIds, setPinnedMediaIds] = useState<Set<string>>(new Set());
  const [pinPending, setPinPending] = useState(false);
  const runVariationsFromNode = useBoardStore(
    (state) => state.runVariationsFromNode,
  );

  const getNodeById = useBoardStore((state) => state.getNodeById);
  const getNodesByIds = useBoardStore((state) => state.getNodesByIds);
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const forkOutputNodeForRegen = useBoardStore(
    (state) => state.forkOutputNodeForRegen,
  );
  const nodesSnapshot = useBoardStore((state) => state.nodes);
  const edgesSnapshot = useBoardStore((state) => state.edges);

  const refreshConnectedData = useCallback(
    (handleId: string, connectedIds: string[]) => {
      if (handleId === "images") {
        if (!connectedIds.length) {
          setConnectedData((prev) =>
            prev.images.length === 0
              ? prev
              : {
                ...prev,
                images: [],
              }
          );
          return;
        }

        // Get fresh node data from the store
        const connectedNodes = getNodesByIds(connectedIds);

        const imageData = connectedNodes
          .map((node) => {
            const payload = (node.data ?? {}) as {
              imageUrl?: string;
              fileName?: string;
              blobPath?: string;
              result?: {
                imageUrl?: string;
                fileName?: string;
                blobPath?: string;
              };
            };

            const resultData = payload.result ?? {};
            const resolvedImageUrl = payload.imageUrl || resultData.imageUrl;

            if (!resolvedImageUrl) {
              return null;
            }

            return {
              nodeId: node.id,
              imageUrl: resolvedImageUrl,
              fileName: payload.fileName || resultData.fileName,
              blobPath: payload.blobPath || resultData.blobPath,
            };
          })
          .filter(Boolean) as Array<{
            nodeId: string;
            imageUrl: string;
            fileName?: string;
            blobPath?: string;
          }>;

        setConnectedData((prev) => {
          const prevImages = prev.images || [];
          const hasChanged =
            prevImages.length !== imageData.length ||
            prevImages.some((prevImg, index) => {
              const newImg = imageData[index];
              return (
                !newImg ||
                prevImg.nodeId !== newImg.nodeId ||
                prevImg.imageUrl !== newImg.imageUrl ||
                prevImg.fileName !== newImg.fileName ||
                prevImg.blobPath !== newImg.blobPath
              );
            });

          if (!hasChanged) {
            return prev;
          }

          return {
            ...prev,
            images: imageData,
          };
        });
      } else if (handleId === "prompt") {
        const promptNode = connectedIds
          .map((nodeId) => getNodeById(nodeId))
          .find(Boolean);

        const promptValue =
          promptNode &&
            promptNode.data &&
            typeof promptNode.data === "object" &&
            "value" in promptNode.data
            ? (promptNode.data as { value?: string }).value ?? ""
            : "";

        setConnectedData((prev) => {
          if (prev.prompt === promptValue) {
            return prev;
          }
          return {
            ...prev,
            prompt: promptValue,
          };
        });
      } else if (handleId === "input") {
        if (!connectedIds.length) {
          setConnectedData((prev) => {
            const noImages = prev.images.length === 0;
            const noPrompt = !prev.prompt;
            return noImages && noPrompt
              ? prev
              : { ...prev, images: [], prompt: "" };
          });
          return;
        }

        const connectedNodes = getNodesByIds(connectedIds);

        const promptText = connectedNodes
          .map((node) => {
            const payload = (node.data ?? {}) as { value?: string };
            return payload.value ?? "";
          })
          .filter((s) => s.length > 0)
          .join("\n");

        const seen = new Set<string>();
        const aggregatedImages: Array<{
          nodeId: string;
          imageUrl: string;
          fileName?: string;
          blobPath?: string;
        }> = [];

        for (const node of connectedNodes) {
          const payload = (node.data ?? {}) as {
            images?: Array<{
              imageUrl: string;
              fileName?: string;
              blobPath?: string;
            }>;
          };
          for (const img of payload.images ?? []) {
            if (!img.imageUrl || seen.has(img.imageUrl)) continue;
            seen.add(img.imageUrl);
            aggregatedImages.push({
              nodeId: node.id,
              imageUrl: img.imageUrl,
              fileName: img.fileName,
              blobPath: img.blobPath,
            });
          }
        }

        setConnectedData((prev) => {
          const promptChanged = prev.prompt !== promptText;
          const prevImages = prev.images || [];
          const imagesChanged =
            prevImages.length !== aggregatedImages.length ||
            prevImages.some((p, i) => {
              const n = aggregatedImages[i];
              return (
                !n ||
                p.nodeId !== n.nodeId ||
                p.imageUrl !== n.imageUrl ||
                p.fileName !== n.fileName ||
                p.blobPath !== n.blobPath
              );
            });
          if (!promptChanged && !imagesChanged) return prev;
          return {
            ...prev,
            prompt: promptText,
            images: aggregatedImages,
          };
        });
      }
    },
    [getNodeById, getNodesByIds, id]
  );

  const handleConnectedIdsChange = useCallback(
    (handleId: string, ids: string[]) => {
      if (handleId === "images") {
        setImageConnectionIds(ids);
      } else if (handleId === "prompt") {
        setPromptConnectionIds(ids);
      } else if (handleId === "input") {
        setInputConnectionIds(ids);
      }
      refreshConnectedData(handleId, ids);
    },
    [refreshConnectedData, id]
  );

  // Separate effect for nodes/edges changes to refresh connected data
  useEffect(() => {
    if (imageConnectionIds.length > 0) {
      refreshConnectedData("images", imageConnectionIds);
    }
    if (promptConnectionIds.length > 0) {
      refreshConnectedData("prompt", promptConnectionIds);
    }
    if (inputConnectionIds.length > 0) {
      refreshConnectedData("input", inputConnectionIds);
    }
  }, [nodesSnapshot, edgesSnapshot, refreshConnectedData, id]);

  // Separate effect for connection ID changes
  useEffect(() => {
    if (imageConnectionIds.length > 0) {
      refreshConnectedData("images", imageConnectionIds);
    }
    if (promptConnectionIds.length > 0) {
      refreshConnectedData("prompt", promptConnectionIds);
    }
    if (inputConnectionIds.length > 0) {
      refreshConnectedData("input", inputConnectionIds);
    }
  }, [
    imageConnectionIds,
    promptConnectionIds,
    inputConnectionIds,
    refreshConnectedData,
    id,
  ]);

  const settingsOptions = canvasHost.models.videoSettings[selectedModel] || {};

  useEffect(() => {
    setModelSettings((prev) => {
      const next = { ...prev };

      if (
        settingsOptions.durations &&
        !settingsOptions.durations.includes(next.duration)
      ) {
        next.duration = settingsOptions.durations[0];
      }
      if (settingsOptions.durationRange) {
        const [min, max] = settingsOptions.durationRange;
        const current = Number(next.duration);
        if (!Number.isFinite(current) || current < min || current > max) {
          next.duration = String(min);
        }
      }
      if (
        settingsOptions.nFrames &&
        !settingsOptions.nFrames.includes(next.nFrames)
      ) {
        next.nFrames = settingsOptions.nFrames[0];
      }
      if (
        settingsOptions.aspectRatios &&
        !settingsOptions.aspectRatios.includes(next.aspectRatio)
      ) {
        next.aspectRatio = settingsOptions.aspectRatios[0];
      }
      if (
        settingsOptions.modes &&
        !settingsOptions.modes.includes(next.mode)
      ) {
        next.mode = settingsOptions.modes[0];
      }
      if (
        settingsOptions.resolutions &&
        !settingsOptions.resolutions.includes(next.resolution)
      ) {
        next.resolution = settingsOptions.resolutions[0];
      }
      if (
        settingsOptions.sizes &&
        !settingsOptions.sizes.includes(next.size)
      ) {
        next.size = settingsOptions.sizes[0];
      }
      if (
        settingsOptions.qualities &&
        !settingsOptions.qualities.includes(next.quality)
      ) {
        next.quality = settingsOptions.qualities[0];
      }
      if (
        settingsOptions.sounds &&
        !settingsOptions.sounds.includes(next.sound)
      ) {
        next.sound = settingsOptions.sounds[0];
      }
      if (
        settingsOptions.promptOptimizers &&
        !settingsOptions.promptOptimizers.includes(next.promptOptimizer)
      ) {
        next.promptOptimizer = settingsOptions.promptOptimizers[0];
      }
      if (
        settingsOptions.fixedLensOptions &&
        !settingsOptions.fixedLensOptions.includes(next.fixedLens)
      ) {
        next.fixedLens = settingsOptions.fixedLensOptions[0];
      }
      if (
        settingsOptions.generateAudioOptions &&
        !settingsOptions.generateAudioOptions.includes(next.generateAudio)
      ) {
        next.generateAudio = settingsOptions.generateAudioOptions[0];
      }
      if (
        settingsOptions.removeWatermarkOptions &&
        !settingsOptions.removeWatermarkOptions.includes(next.removeWatermark)
      ) {
        next.removeWatermark = settingsOptions.removeWatermarkOptions[0];
      }

      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [
    settingsOptions.aspectRatios,
    settingsOptions.durations,
    settingsOptions.fixedLensOptions,
    settingsOptions.generateAudioOptions,
    settingsOptions.modes,
    settingsOptions.nFrames,
    settingsOptions.promptOptimizers,
    settingsOptions.qualities,
    settingsOptions.removeWatermarkOptions,
    settingsOptions.resolutions,
    settingsOptions.sizes,
    settingsOptions.sounds,
  ]);

  useEffect(() => {
    updateNodeData(id, { selectedModel, modelSettings });
  }, [id, modelSettings, selectedModel, updateNodeData]);

  const updateSettings = (updates: Partial<VideoModelSettings>) => {
    setModelSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    updateNodeData(id, { selectedModel: model });
  };

  const handleGenerate = async () => {
    // Guard against double-clicks/programmatic dupes. Without this, two
    // rapid clicks fork twice → two separate reservations → user pays for
    // two generations from one intent.
    if (isGenerating || generatedResult?.status === "generating") return;
    setIsGenerating(true);
    try {
      if (!data.onGenerate) return;
      // If a previous generation already completed on this node, fork to
      // a new node so the existing video stays preserved. Iterating in
      // place (no completed result yet, or one in progress / errored) just
      // overwrites as before.
      const targetNodeId =
        generatedResult?.status === "completed" && generatedResult?.videoUrl
          ? forkOutputNodeForRegen(id) ?? id
          : id;
      await data.onGenerate(targetNodeId, {
        ...connectedData,
        model: selectedModel,
        settings: modelSettings,
      });
    } catch (error) {
      console.error("Video generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    if (data.onCancelGenerate) {
      data.onCancelGenerate(id);
    }
    setIsGenerating(false);
  };

  // Get current model info
  const currentModel = availableModels.find((m) => m.value === selectedModel) ?? {
    value: selectedModel,
    label: selectedModel,
    cost: 0,
    supportsImage: true,
  };
  const modelSupportsImage = currentModel.supportsImage;
  const modelRequiresImage = currentModel.requiresImage ?? false;

  // Estimated credits to charge on Generate (model + duration + resolution).
  const estimatedVideoCost = canvasHost.costPreview({
    kind: "video",
    model: selectedModel,
    duration: modelSettings.duration,
    resolution:
      modelSettings.resolution || modelSettings.quality || modelSettings.size,
    // Seedance toggles via `generateAudio`; Kling 3.0 / 2.6 toggle via
    // `sound`. Either flag means audio is on for billing purposes.
    generateAudio:
      modelSettings.generateAudio === true || modelSettings.sound === true,
  });

  const handleDownloadVideo = async (videoUrl: string, prompt?: string) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = prompt
        ? `generated-video-${prompt
          .slice(0, 30)
          .replace(/[^a-zA-Z0-9]/g, "-")}-${timestamp}.mp4`
        : `generated-video-${timestamp}.mp4`;

      const proxyUrl = `/api/download-asset?url=${encodeURIComponent(
        videoUrl,
      )}&filename=${encodeURIComponent(filename)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Video download failed:", error);
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowPreview(!showPreview)}
        className="h-5 px-2 text-xs shadow-none"
      >
        {showPreview ? "Hide" : "Show"}
      </Button>
    </div>
  );

  const hasImageConnections = imageConnectionIds.length > 0;
  const hasLegacyPromptEdge = edgesSnapshot.some(
    (e) => e.target === id && e.targetHandle === "prompt",
  );
  const hasLegacyImagesEdge = edgesSnapshot.some(
    (e) => e.target === id && e.targetHandle === "images",
  );

  return (
    <NodeBox
      id={id}
      title={data.label}
      icon={<Video className="h-4 w-4" />}
      isConnectable={isConnectable}
      onDelete={data.onDelete}
      headerActions={headerActions}
      minWidth="320px"
      nodeType="videoNode"
      onCreateNode={data.onCreateNode}
      selected={selected}
    >
      <div className="space-y-1">
        <div className="flex">
          <CustomHandle
            id="input"
            label=""
            onChange={(ids) => handleConnectedIdsChange("input", ids)}
          />
        </div>
        <div className="flex">
          <CustomHandle
            id="images"
            label=""
            onChange={(ids) => handleConnectedIdsChange("images", ids)}
            hidden={!hasLegacyImagesEdge}
          />
        </div>
        <div className="flex">
          <CustomHandle
            id="prompt"
            label=""
            onChange={(ids) => handleConnectedIdsChange("prompt", ids)}
            hidden={!hasLegacyPromptEdge}
          />
        </div>
      </div>

      <div className="space-y-3">
        {/* Model Selector */}
        <div className="flex flex-col gap-1">
          <ModelCombobox
            options={availableModels}
            value={selectedModel}
            onValueChange={handleModelChange}
            placeholder="Select model…"
          />
          <div className="text-[10px] text-muted-foreground">
            {!currentModel.supportsImage && " (text-to-video only)"}
          </div>
        </div>

        {(settingsOptions.durations ||
          settingsOptions.durationRange ||
          settingsOptions.nFrames ||
          settingsOptions.aspectRatios ||
          settingsOptions.modes ||
          settingsOptions.sounds ||
          settingsOptions.resolutions ||
          settingsOptions.sizes ||
          settingsOptions.qualities ||
          settingsOptions.promptOptimizers ||
          settingsOptions.fixedLensOptions ||
          settingsOptions.generateAudioOptions ||
          settingsOptions.removeWatermarkOptions) && (
          <div className="rounded-md border bg-muted/30 p-2 space-y-2">
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="flex w-full items-center justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            >
              <span>Model Settings</span>
              {showSettings ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            {showSettings && (
            <div className="grid grid-cols-2 gap-2">
              {settingsOptions.durationRange ? (
                <div className="col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Duration
                    </span>
                    <span className="text-[11px] tabular-nums font-medium">
                      {modelSettings.duration}s
                    </span>
                  </div>
                  <Slider
                    min={settingsOptions.durationRange[0]}
                    max={settingsOptions.durationRange[1]}
                    step={1}
                    value={[
                      Math.min(
                        Math.max(
                          Number(modelSettings.duration) || settingsOptions.durationRange[0],
                          settingsOptions.durationRange[0],
                        ),
                        settingsOptions.durationRange[1],
                      ),
                    ]}
                    onValueChange={([value]) =>
                      updateSettings({ duration: String(value) })
                    }
                  />
                </div>
              ) : settingsOptions.durations ? (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Duration</div>
                  <Select
                    value={modelSettings.duration}
                    onValueChange={(value) => updateSettings({ duration: value })}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.durations.map((value) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {value}s
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {settingsOptions.nFrames && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Frames</div>
                  <Select
                    value={modelSettings.nFrames}
                    onValueChange={(value) => updateSettings({ nFrames: value })}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.nFrames.map((value) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.aspectRatios && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Aspect</div>
                  <Select
                    value={modelSettings.aspectRatio}
                    onValueChange={(value) => updateSettings({ aspectRatio: value })}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.aspectRatios.map((value) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.modes && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Mode</div>
                  <Select
                    value={modelSettings.mode}
                    onValueChange={(value) => updateSettings({ mode: value })}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.modes.map((value) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.sounds && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Sound</div>
                  <Select
                    value={modelSettings.sound ? "true" : "false"}
                    onValueChange={(value) =>
                      updateSettings({ sound: value === "true" })
                    }
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.sounds.map((value) => (
                        <SelectItem
                          key={value ? "true" : "false"}
                          value={value ? "true" : "false"}
                          className="text-xs"
                        >
                          {value ? "On" : "Off"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.resolutions && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Resolution</div>
                  <Select
                    value={modelSettings.resolution}
                    onValueChange={(value) => updateSettings({ resolution: value })}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.resolutions.map((value) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.sizes && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Size</div>
                  <Select
                    value={modelSettings.size}
                    onValueChange={(value) => updateSettings({ size: value })}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.sizes.map((value) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.qualities && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Quality</div>
                  <Select
                    value={modelSettings.quality}
                    onValueChange={(value) => updateSettings({ quality: value })}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.qualities.map((value) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.promptOptimizers && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Prompt Opt</div>
                  <Select
                    value={modelSettings.promptOptimizer ? "true" : "false"}
                    onValueChange={(value) =>
                      updateSettings({ promptOptimizer: value === "true" })
                    }
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.promptOptimizers.map((value) => (
                        <SelectItem
                          key={value ? "true" : "false"}
                          value={value ? "true" : "false"}
                          className="text-xs"
                        >
                          {value ? "On" : "Off"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.fixedLensOptions && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Fixed Lens</div>
                  <Select
                    value={modelSettings.fixedLens ? "true" : "false"}
                    onValueChange={(value) =>
                      updateSettings({ fixedLens: value === "true" })
                    }
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.fixedLensOptions.map((value) => (
                        <SelectItem
                          key={value ? "true" : "false"}
                          value={value ? "true" : "false"}
                          className="text-xs"
                        >
                          {value ? "On" : "Off"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.generateAudioOptions && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Audio</div>
                  <Select
                    value={modelSettings.generateAudio ? "true" : "false"}
                    onValueChange={(value) =>
                      updateSettings({ generateAudio: value === "true" })
                    }
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.generateAudioOptions.map((value) => (
                        <SelectItem
                          key={value ? "true" : "false"}
                          value={value ? "true" : "false"}
                          className="text-xs"
                        >
                          {value ? "On" : "Off"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settingsOptions.removeWatermarkOptions && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">Watermark</div>
                  <Select
                    value={modelSettings.removeWatermark ? "true" : "false"}
                    onValueChange={(value) =>
                      updateSettings({ removeWatermark: value === "true" })
                    }
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsOptions.removeWatermarkOptions.map((value) => (
                        <SelectItem
                          key={value ? "true" : "false"}
                          value={value ? "true" : "false"}
                          className="text-xs"
                        >
                          {value ? "On" : "Off"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <TooltipProvider>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${connectedData.images.length
                      ? "bg-blue-50"
                      : hasImageConnections
                        ? "bg-amber-50"
                        : modelSupportsImage
                          ? "bg-gray-50"
                          : "bg-gray-50/50"
                      }`}
                  >
                    <Video className={`w-3 h-3 ${modelSupportsImage ? "text-blue-600" : "text-muted-foreground"}`} />
                    <span className={`text-xs font-medium ${modelSupportsImage ? "text-blue-700" : "text-muted-foreground"}`}>
                      {connectedData.images.length}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {!modelSupportsImage
                      ? "Image input not used for this model"
                      : hasImageConnections
                        ? `${connectedData.images.length} connected image${connectedData.images.length === 1 ? "" : "s"
                        }`
                        : "No image nodes connected"}
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${connectedData.prompt ? "bg-green-50" : "bg-gray-50"
                      }`}
                  >
                    <MessageSquare
                      className={`w-3 h-3 ${connectedData.prompt
                        ? "text-green-600"
                        : "text-muted-foreground"
                        }`}
                    />
                    <span
                      className={`text-xs font-medium ${connectedData.prompt
                        ? "text-green-700"
                        : "text-muted-foreground"
                        }`}
                    >
                      {connectedData.prompt ? "1" : "0"}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {connectedData.prompt
                      ? "Prompt connected"
                      : "No prompt connected"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <div className="flex items-center gap-1">
            {(isGenerating || generatedResult?.status === "generating") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCancelGeneration}
                    aria-label="Cancel generation"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cancel</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                generatedResult?.status === "generating" ||
                (modelRequiresImage && connectedData.images.length === 0) ||
                !connectedData.prompt
              }
              size="sm"
              className="text-xs"
            >
              {isGenerating || generatedResult?.status === "generating" ? (
                "Generating..."
              ) : (
                <>
                  Generate Video
                  {estimatedVideoCost ? (
                    <span className="ml-1 opacity-70">
                      · {Math.ceil(estimatedVideoCost.credits)} cr
                    </span>
                  ) : null}
                </>
              )}
            </Button>
          </div>
        </div>

        {(isGenerating || generatedResult?.status === "generating") && (
          <Progress indeterminate className="w-full h-1" />
        )}

        {showPreview &&
          hasImageConnections &&
          connectedData.images.length === 0 && (
            <div className="text-xs text-muted-foreground bg-muted/20 border rounded p-2">
              Waiting for image data from connected nodes...
            </div>
          )}

        {showPreview && connectedData.images.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-foreground">
              Connected Images ({connectedData.images.length}):
            </div>
            <div className="flex flex-wrap gap-2">
              {connectedData.images.map((image, index) => (
                <div key={image.nodeId ?? index} className="relative group">
                  <NextImage
                    src={image.imageUrl}
                    alt={`Connected image ${index + 1}`}
                    width={60}
                    height={60}
                    className="w-[60px] h-[60px] object-cover rounded border"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {image.fileName || "Image"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {generatedResult && (
          <div className="space-y-2 border-t pt-2">
            <div className="text-xs font-medium text-foreground">
              Generated Video:
            </div>

            {generatedResult.status === "generating" && (
              <div className="text-xs text-blue-600">Generating video...</div>
            )}

            {generatedResult.status === "error" && (
              <div className="text-xs text-red-600">
                Error: {generatedResult.error}
              </div>
            )}

            {generatedResult.status === "completed" &&
              generatedResult.videoUrl && (
                <div className="space-y-2">
                  <div className="relative group">
                    <video
                      src={generatedResult.videoUrl}
                      controls
                      className="w-full max-w-[320px] h-auto rounded border"
                      poster={connectedData.images[0]?.imageUrl}
                    />
                    <div className="nodrag absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadVideo(
                            generatedResult.videoUrl!,
                            generatedResult.prompt
                          );
                        }}
                        className="h-8 w-8 p-0 bg-background/90 hover:bg-accent border cursor-pointer"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {generatedMediaIds[0] && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pinPending}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const mediaId = generatedMediaIds[0];
                              if (!mediaId) return;
                              setPinPending(true);
                              const next = !pinnedMediaIds.has(mediaId);
                              try {
                                const result = await canvasHost.actions.pinMedia(mediaId, next);
                                if (result.success) {
                                  canvasHost.track("history.pinned", {
                                    mediaId,
                                    on: next,
                                  });
                                  setPinnedMediaIds((prev) => {
                                    const updated = new Set(prev);
                                    if (next) updated.add(mediaId);
                                    else updated.delete(mediaId);
                                    return updated;
                                  });
                                }
                              } finally {
                                setPinPending(false);
                              }
                            }}
                            className={`h-8 w-8 p-0 ${
                              pinnedMediaIds.has(generatedMediaIds[0])
                                ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                                : "bg-background/90 hover:bg-accent border cursor-pointer"
                            }`}
                            title={
                              pinnedMediaIds.has(generatedMediaIds[0])
                                ? "Unpin"
                                : "Pin to top of history"
                            }
                          >
                            <Pin className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              const mediaId = generatedMediaIds[0];
                              if (mediaId) {
                                canvasHost.track("generation.variations_clicked", {
                                  parentMediaId: mediaId,
                                  kind: "video",
                                  requested: 1,
                                });
                                runVariationsFromNode(mediaId, 1);
                              }
                            }}
                            className="h-8 w-8 p-0 bg-background/90 hover:bg-accent border cursor-pointer"
                            title="Make a variation"
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Generated with: &quot;{generatedResult.prompt}&quot;
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </NodeBox>
  );
}

export default VideoNode;
