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
import { ModelCombobox } from "../model-combobox";
import { NodeBox } from "./node-box";
import {
  Image,
  MessageSquare,
  Download,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Pencil,
  Pin,
  Sparkles,
  X,
} from "lucide-react";
import { useBoardStore } from "../../../stores/board-store";
import { ImageEditorModal } from "../image-editor-modal";
import { WildcardChip } from "../wildcard-chip";
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

export const AVAILABLE_MODELS = [
  { value: "kie/4o-image", label: "GPT-Image-1 (4o)" },
  { value: "kie/nano-banana", label: "Nano Banana" },
  { value: "kie/nano-banana-pro", label: "Nano Banana Pro" },
  { value: "kie/nano-banana-2", label: "Nano Banana 2" },
  { value: "kie/flux-kontext", label: "Flux Kontext Pro" },
  { value: "kie/imagen-4", label: "Google Imagen 4" },
  { value: "kie/imagen-4-fast", label: "Imagen 4 Fast" },
  { value: "kie/imagen-4-ultra", label: "Imagen 4 Ultra" },
  { value: "kie/flux-2", label: "Flux-2 Pro" },
  { value: "kie/seedream-4", label: "Seedream 4.0" },
  { value: "kie/qwen", label: "Qwen" },
  { value: "kie/ideogram", label: "Ideogram" },
  { value: "kie/grok-imagine", label: "Grok Imagine" },
  { value: "kie/z-image", label: "Z-Image" },
  { value: "kie/gpt-image-2", label: "GPT Image 2" },
  { value: "kie/gpt-image-2-5-flare", label: "GPT Image 2.5 Flare" },
  { value: "kie/gpt-image-2-5-sunburst", label: "GPT Image 2.5 Sunburst" },
  { value: "openai/gpt-image-1", label: "GPT Image 1" },
  { value: "openai/gpt-image-1-mini", label: "GPT Image 1 Mini" },
  { value: "openai/gpt-image-1.5", label: "GPT Image 1.5" },
  { value: "openai/gpt-image-2", label: "GPT Image 2" },
  { value: "openai/gpt-image-2.5-flare", label: "GPT Image 2.5 Flare" },
  { value: "openai/gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst" },
  { value: "google/gemini-2.5-flash-image", label: "Nano Banana" },
  { value: "google/gemini-3-pro-image", label: "Nano Banana Pro" },
  { value: "google/gemini-3.1-flash-image", label: "Nano Banana 2" },
  { value: "google/gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite" },
];

// Models from providers the host has not enabled are hidden from the picker.
function modelsForProviders(enabled: readonly string[]) {
  return AVAILABLE_MODELS.filter((model) => enabled.includes(model.value.split("/")[0]));
}

const OPENAI_IMAGE_SETTINGS = {
  aspectRatios: ["1:1", "3:2", "2:3", "auto"],
  qualities: ["auto", "low", "medium", "high"],
  outputFormats: ["png", "jpeg", "webp"],
  variantCounts: [1, 2, 3, 4],
};

const GEMINI_IMAGE_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto"];

const GPT_IMAGE_2_5_SETTINGS = {
  aspectRatios: [
    "auto",
    "1:1",
    "3:2",
    "2:3",
    "4:3",
    "3:4",
    "16:9",
    "9:16",
    "21:9",
    "27:16",
    "16:27",
    "9:8",
    "8:9",
  ],
  imageResolutions: ["1K", "2K", "4K"],
};

type ModelSettings = {
  aspectRatio: string;
  imageSize: string;
  imageResolution: string;
  quality: string;
  style: string;
  renderingSpeed: string;
  outputFormat: string;
  nVariants: number;
};

const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  aspectRatio: "1:1",
  imageSize: "square_hd",
  imageResolution: "1K",
  quality: "STANDARD",
  style: "AUTO",
  renderingSpeed: "BALANCED",
  outputFormat: "png",
  nVariants: 1,
};

const MODEL_SETTING_OPTIONS: Record<
  string,
  {
    aspectRatios?: string[];
    imageSizes?: string[];
    imageResolutions?: string[];
    qualities?: string[];
    styles?: string[];
    renderingSpeeds?: string[];
    outputFormats?: string[];
    variantCounts?: number[];
  }
> = {
  "openai/gpt-image-1": OPENAI_IMAGE_SETTINGS,
  "openai/gpt-image-1-mini": OPENAI_IMAGE_SETTINGS,
  "openai/gpt-image-1.5": OPENAI_IMAGE_SETTINGS,
  "openai/gpt-image-2": OPENAI_IMAGE_SETTINGS,
  "openai/gpt-image-2.5-flare": OPENAI_IMAGE_SETTINGS,
  "openai/gpt-image-2.5-sunburst": OPENAI_IMAGE_SETTINGS,
  "google/gemini-2.5-flash-image": { aspectRatios: GEMINI_IMAGE_ASPECT_RATIOS },
  "google/gemini-3-pro-image": {
    aspectRatios: GEMINI_IMAGE_ASPECT_RATIOS,
    imageResolutions: ["1K", "2K", "4K"],
  },
  "google/gemini-3.1-flash-image": {
    aspectRatios: GEMINI_IMAGE_ASPECT_RATIOS,
    imageResolutions: ["1K", "2K", "4K"],
  },
  "google/gemini-3.1-flash-lite-image": { aspectRatios: GEMINI_IMAGE_ASPECT_RATIOS },
  "kie/4o-image": {
    aspectRatios: ["1:1", "16:9", "9:16", "3:4", "4:3"],
  },
  "kie/nano-banana": {
    imageSizes: ["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9", "auto"],
    outputFormats: ["png", "jpeg"],
  },
  "kie/nano-banana-pro": {
    aspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto"],
    qualities: ["STANDARD", "HIGH", "ULTRA"],
    outputFormats: ["png", "jpeg"],
  },
  "kie/nano-banana-2": {
    aspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "4:1", "1:4", "8:1", "21:9", "auto"],
    qualities: ["STANDARD", "HIGH", "ULTRA"],
    outputFormats: ["png", "jpeg"],
  },
  "kie/flux-kontext": {
    aspectRatios: ["1:1", "16:9", "9:16", "3:4", "4:3"],
  },
  "kie/imagen-4": {
    aspectRatios: ["1:1", "16:9", "9:16", "3:4", "4:3"],
  },
  "kie/imagen-4-fast": {
    aspectRatios: ["1:1", "16:9", "9:16", "3:4", "4:3"],
    variantCounts: [1, 2, 3, 4],
  },
  "kie/imagen-4-ultra": {
    aspectRatios: ["1:1", "16:9", "9:16", "3:4", "4:3"],
  },
  "kie/flux-2": {
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "auto"],
    imageResolutions: ["1K", "2K"],
  },
  "kie/seedream-4": {
    imageSizes: [
      "square",
      "square_hd",
      "portrait_4_3",
      "portrait_3_2",
      "portrait_16_9",
      "landscape_4_3",
      "landscape_3_2",
      "landscape_16_9",
      "landscape_21_9",
    ],
    qualities: ["STANDARD", "HIGH", "ULTRA"],
    variantCounts: [1, 2, 3, 4, 5, 6],
  },
  "kie/qwen": {
    imageSizes: [
      "square",
      "square_hd",
      "portrait_4_3",
      "portrait_16_9",
      "landscape_4_3",
      "landscape_16_9",
    ],
    outputFormats: ["png", "jpeg"],
  },
  "kie/ideogram": {
    imageSizes: [
      "square",
      "square_hd",
      "portrait_4_3",
      "portrait_16_9",
      "landscape_4_3",
      "landscape_16_9",
    ],
    styles: ["AUTO", "REALISTIC", "FICTION"],
    qualities: ["BALANCED", "FAST", "HIGH"],
    variantCounts: [1, 2, 3, 4],
  },
  "kie/grok-imagine": {
    aspectRatios: ["2:3", "3:2", "1:1", "16:9", "9:16"],
  },
  "kie/z-image": {
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  },
  "kie/gpt-image-2": {
    // Per Kie docs (docs.kie.ai/market/gpt/gpt-image-2-*): aspect_ratio
    // accepts only these six values, and resolution is 1K/2K/4K. Any
    // other aspect ratio returns a validation error.
    aspectRatios: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4"],
    imageResolutions: ["1K", "2K", "4K"],
  },
  // Per Kie docs (docs.kie.ai/market/gpt/gpt-image-2-5-*): both variants
  // take the same inputs. 27:16, 16:27, 9:8 and 8:9 support 1K only.
  "kie/gpt-image-2-5-flare": GPT_IMAGE_2_5_SETTINGS,
  "kie/gpt-image-2-5-sunburst": GPT_IMAGE_2_5_SETTINGS,
};

const GPT_IMAGE_2_5_1K_ONLY_RATIOS = new Set(["27:16", "16:27", "9:8", "8:9"]);

// Cross-axis constraint: some models forbid specific aspect_ratio +
// resolution combos. Filter the resolution dropdown to keep users from
// picking invalid pairs that fail at the provider.
function filterValidImageResolutions(
  model: string,
  aspectRatio: string | undefined,
  baseList: string[] | undefined,
): string[] | undefined {
  if (!baseList) return baseList;
  if (model === "kie/gpt-image-2") {
    // docs.kie.ai: aspect_ratio="auto" only outputs 1K; aspect_ratio="1:1"
    // does not support 4K.
    if (aspectRatio === "auto") return baseList.filter((r) => r === "1K");
    if (aspectRatio === "1:1") return baseList.filter((r) => r !== "4K");
  }
  if (
    model === "kie/gpt-image-2-5-flare" ||
    model === "kie/gpt-image-2-5-sunburst"
  ) {
    // docs.kie.ai: these four ratios output 1K only. createTask accepts
    // other tiers for them anyway, so the picker has to enforce it.
    if (GPT_IMAGE_2_5_1K_ONLY_RATIOS.has(aspectRatio ?? "")) {
      return baseList.filter((r) => r === "1K");
    }
  }
  return baseList;
}

interface OutputNodeProps {
  id: string;
  data: {
    label: string;
    result?: {
      status?: "generating" | "completed" | "error";
      imageUrl?: string;
      imageUrls?: string[];
      prompt?: string;
      error?: string;
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
        settings?: Partial<ModelSettings>;
      }
    ) => void;
    onCancelGenerate?: (nodeId: string) => void;
    onCreateNode?: (nodeType: string) => void;
    selectedModel?: string;
    modelSettings?: Partial<ModelSettings>;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

function OutputNode({ id, data, isConnectable, selected }: OutputNodeProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showGeneratedPrompt, setShowGeneratedPrompt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageConnectionIds, setImageConnectionIds] = useState<string[]>([]);
  const [promptConnectionIds, setPromptConnectionIds] = useState<string[]>([]);
  const [inputConnectionIds, setInputConnectionIds] = useState<string[]>([]);
  const canvasHost = useCanvasHost();
  const availableModels = modelsForProviders(canvasHost.enabledProviders);
  const defaultModel = availableModels[0]?.value ?? "kie/4o-image";
  const [selectedModel, setSelectedModel] = useState(
    typeof data.selectedModel === "string" ? data.selectedModel : defaultModel
  );
  const [modelSettings, setModelSettings] = useState<ModelSettings>(() => {
    const savedSettings =
      data.modelSettings && typeof data.modelSettings === "object"
        ? (data.modelSettings as Record<string, unknown>)
        : {};
    const savedVariants =
      typeof savedSettings.nVariants === "number"
        ? savedSettings.nVariants
        : typeof savedSettings.batchCount === "number"
          ? savedSettings.batchCount
          : DEFAULT_MODEL_SETTINGS.nVariants;

    return {
      ...DEFAULT_MODEL_SETTINGS,
      ...(savedSettings as Partial<ModelSettings>),
      nVariants: savedVariants,
    };
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [connectedData, setConnectedData] = useState<{
    images: Array<{
      nodeId: string;
      imageUrl: string;
      fileName?: string;
      blobPath?: string;
      fileSize?: number;
    }>;
    prompt: string;
  }>({
    images: [],
    prompt: "",
  });

  // Estimated credits to charge on Generate. The host mirrors the
  // server-side reservation so users see the cost up front.
  const estimatedImageCost = canvasHost.costPreview({
    kind: "image",
    model: selectedModel,
    count: modelSettings.nVariants,
  });

  const generatedResult = data.result;
  const generatedImageUrls = generatedResult?.imageUrls?.length
    ? generatedResult.imageUrls
    : generatedResult?.imageUrl
      ? [generatedResult.imageUrl]
      : [];
  const generatedMediaIds: string[] = Array.isArray(data.mediaIds)
    ? data.mediaIds
    : Array.isArray(generatedResult?.mediaIds)
      ? (generatedResult.mediaIds as string[])
      : [];
  const [activeGeneratedImageIndex, setActiveGeneratedImageIndex] = useState(0);
  const [pinnedMediaIds, setPinnedMediaIds] = useState<Set<string>>(new Set());
  const [pinPending, setPinPending] = useState(false);
  const runVariationsFromNode = useBoardStore(
    (state) => state.runVariationsFromNode,
  );
  const runBulkGeneration = useBoardStore((state) => state.runBulkGeneration);

  const getNodeById = useBoardStore((state) => state.getNodeById);
  const getNodesByIds = useBoardStore((state) => state.getNodesByIds);
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const nodesSnapshot = useBoardStore((state) => state.nodes);
  const edgesSnapshot = useBoardStore((state) => state.edges);
  const createNodeWithType = useBoardStore((state) => state.createNodeWithType);
  const forkOutputNodeForRegen = useBoardStore(
    (state) => state.forkOutputNodeForRegen,
  );
  const boardId = useBoardStore((state) => state.boardId);

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
              fileSize?: number;
              result?: {
                imageUrl?: string;
                fileName?: string;
                blobPath?: string;
                fileSize?: number;
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
              fileSize: payload.fileSize || resultData.fileSize,
            };
          })
          .filter(Boolean) as Array<{
          nodeId: string;
          imageUrl: string;
          fileName?: string;
          blobPath?: string;
          fileSize?: number;
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
          fileSize?: number;
        }> = [];

        for (const node of connectedNodes) {
          const payload = (node.data ?? {}) as {
            images?: Array<{
              imageUrl: string;
              fileName?: string;
              blobPath?: string;
              fileSize?: number;
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
              fileSize: img.fileSize,
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

  const settingsOptions = MODEL_SETTING_OPTIONS[selectedModel] || {};

  useEffect(() => {
    setModelSettings((prev) => {
      const next = { ...prev };

      if (
        settingsOptions.aspectRatios &&
        !settingsOptions.aspectRatios.includes(next.aspectRatio)
      ) {
        next.aspectRatio = settingsOptions.aspectRatios[0];
      }
      if (
        settingsOptions.imageSizes &&
        !settingsOptions.imageSizes.includes(next.imageSize)
      ) {
        next.imageSize = settingsOptions.imageSizes[0];
      }
      const validResolutions = filterValidImageResolutions(
        selectedModel,
        next.aspectRatio,
        settingsOptions.imageResolutions,
      );
      if (validResolutions && !validResolutions.includes(next.imageResolution)) {
        next.imageResolution = validResolutions[0];
      }
      if (
        settingsOptions.qualities &&
        !settingsOptions.qualities.includes(next.quality)
      ) {
        next.quality = settingsOptions.qualities[0];
      }
      if (settingsOptions.styles && !settingsOptions.styles.includes(next.style)) {
        next.style = settingsOptions.styles[0];
      }
      if (
        settingsOptions.renderingSpeeds &&
        !settingsOptions.renderingSpeeds.includes(next.renderingSpeed)
      ) {
        next.renderingSpeed = settingsOptions.renderingSpeeds[0];
      }
      if (
        settingsOptions.outputFormats &&
        !settingsOptions.outputFormats.includes(next.outputFormat)
      ) {
        next.outputFormat = settingsOptions.outputFormats[0];
      }
      if (
        settingsOptions.variantCounts &&
        !settingsOptions.variantCounts.includes(next.nVariants)
      ) {
        next.nVariants = settingsOptions.variantCounts[0];
      } else if (!settingsOptions.variantCounts && next.nVariants !== 1) {
        next.nVariants = 1;
      }

      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [
    id,
    selectedModel,
    settingsOptions.aspectRatios,
    settingsOptions.variantCounts,
    settingsOptions.imageResolutions,
    settingsOptions.imageSizes,
    settingsOptions.qualities,
    settingsOptions.renderingSpeeds,
    settingsOptions.styles,
    settingsOptions.outputFormats,
  ]);

  useEffect(() => {
    updateNodeData(id, { modelSettings });
  }, [id, modelSettings, updateNodeData]);

  const updateSettings = (updates: Partial<ModelSettings>) => {
    setModelSettings((prev) => {
      const next = { ...prev, ...updates };
      // When the user picks a new aspect ratio, the previously-selected
      // resolution may no longer be valid for the new combo (GPT Image 2:
      // auto→1K only, 1:1→no 4K). Snap to a valid value instead of letting
      // the provider reject it later.
      if (updates.aspectRatio !== undefined) {
        const valid = filterValidImageResolutions(
          selectedModel,
          next.aspectRatio,
          settingsOptions.imageResolutions,
        );
        if (valid && !valid.includes(next.imageResolution)) {
          next.imageResolution = valid[0];
        }
      }
      return next;
    });
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    updateNodeData(id, { selectedModel: model });
  };

  useEffect(() => {
    if (activeGeneratedImageIndex >= generatedImageUrls.length) {
      setActiveGeneratedImageIndex(0);
    }
  }, [activeGeneratedImageIndex, generatedImageUrls.length]);

  const handleGenerate = async () => {
    // Guard against double-clicks/programmatic dupes. Without this, two
    // rapid clicks fork twice → two separate reservations → user pays for
    // two generations from one intent.
    if (isGenerating || generatedResult?.status === "generating") return;
    const sanitizedSettings: ModelSettings = {
      ...modelSettings,
      nVariants:
        settingsOptions.variantCounts?.includes(modelSettings.nVariants)
          ? modelSettings.nVariants
          : 1,
      quality:
        settingsOptions.qualities?.includes(modelSettings.quality)
          ? modelSettings.quality
          : settingsOptions.qualities?.[0] || modelSettings.quality,
    };

    // Wildcards in the prompt → bulk endpoint.
    if (
      boardId &&
      typeof connectedData.prompt === "string" &&
      connectedData.prompt.includes("{")
    ) {
      // Clear any stale error on the node so the user isn't looking at a
      // previous failure while the bulk run is being submitted.
      const existingResult = (data.result ?? {}) as Record<string, unknown>;
      if (existingResult.status === "error") {
        updateNodeData(id, {
          result: { ...existingResult, status: undefined, error: undefined },
        });
      }
      setIsGenerating(true);
      try {
        await runBulkGeneration({
          boardId,
          nodeId: id,
          prompt: connectedData.prompt,
          model: selectedModel,
          settings: sanitizedSettings as Record<string, unknown>,
          images: connectedData.images,
        });
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    setIsGenerating(true);
    try {
      if (!data.onGenerate) return;
      // Fork to a new node when regenerating after a completed run, so
      // the previous output stays on the canvas. Edits/retries before any
      // success keep overwriting in place.
      const hasCompletedImage =
        generatedResult?.status === "completed" &&
        generatedImageUrls.length > 0;
      const targetNodeId = hasCompletedImage
        ? forkOutputNodeForRegen(id) ?? id
        : id;
      await data.onGenerate(targetNodeId, {
        ...connectedData,
        model: selectedModel,
        settings: sanitizedSettings,
      });
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    setIsGenerating(false);
    data.onCancelGenerate?.(id);
  };

  const handleDownloadImage = async (imageUrl: string, prompt?: string) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = prompt
        ? `generated-image-${prompt
            .slice(0, 30)
            .replace(/[^a-zA-Z0-9]/g, "-")}-${timestamp}.png`
        : `generated-image-${timestamp}.png`;

      const proxyUrl = `/api/download-asset?url=${encodeURIComponent(
        imageUrl,
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
      console.error("Download failed:", error);
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
      icon={<Image className="h-4 w-4" />}
      isConnectable={isConnectable}
      onDelete={data.onDelete}
      headerActions={headerActions}
      minWidth="320px"
      nodeType="outputNode"
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

      <div className="space-y-3 p-1">
        <div className="flex flex-col gap-2">
          {(settingsOptions.aspectRatios ||
            settingsOptions.imageSizes ||
            settingsOptions.imageResolutions ||
            settingsOptions.qualities ||
            settingsOptions.styles ||
            settingsOptions.renderingSpeeds ||
            settingsOptions.outputFormats ||
            settingsOptions.variantCounts) &&
            showSettings && (
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="grid grid-cols-2 gap-2">
                {settingsOptions.aspectRatios && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Aspect</div>
                    <Select
                      value={modelSettings.aspectRatio}
                      onValueChange={(value) =>
                        updateSettings({ aspectRatio: value })
                      }
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {settingsOptions.aspectRatios.map((ratio) => (
                          <SelectItem key={ratio} value={ratio} className="text-xs">
                            {ratio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {settingsOptions.imageSizes && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Size</div>
                    <Select
                      value={modelSettings.imageSize}
                      onValueChange={(value) => updateSettings({ imageSize: value })}
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {settingsOptions.imageSizes.map((size) => (
                          <SelectItem key={size} value={size} className="text-xs">
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {settingsOptions.imageResolutions && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Resolution</div>
                    <Select
                      value={modelSettings.imageResolution}
                      onValueChange={(value) =>
                        updateSettings({ imageResolution: value })
                      }
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          filterValidImageResolutions(
                            selectedModel,
                            modelSettings.aspectRatio,
                            settingsOptions.imageResolutions,
                          ) ?? settingsOptions.imageResolutions
                        ).map((resolution) => (
                          <SelectItem
                            key={resolution}
                            value={resolution}
                            className="text-xs"
                          >
                            {resolution}
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
                        {settingsOptions.qualities.map((quality) => (
                          <SelectItem key={quality} value={quality} className="text-xs">
                            {quality}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {settingsOptions.styles && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Style</div>
                    <Select
                      value={modelSettings.style}
                      onValueChange={(value) => updateSettings({ style: value })}
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {settingsOptions.styles.map((style) => (
                          <SelectItem key={style} value={style} className="text-xs">
                            {style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {settingsOptions.renderingSpeeds && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Speed</div>
                    <Select
                      value={modelSettings.renderingSpeed}
                      onValueChange={(value) =>
                        updateSettings({ renderingSpeed: value })
                      }
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {settingsOptions.renderingSpeeds.map((speed) => (
                          <SelectItem key={speed} value={speed} className="text-xs">
                            {speed}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {settingsOptions.outputFormats && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Format</div>
                    <Select
                      value={modelSettings.outputFormat}
                      onValueChange={(value) => updateSettings({ outputFormat: value })}
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {settingsOptions.outputFormats.map((format) => (
                          <SelectItem key={format} value={format} className="text-xs">
                            {format}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {settingsOptions.variantCounts && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Variants</div>
                    <Select
                      value={String(modelSettings.nVariants)}
                      onValueChange={(value) =>
                        updateSettings({ nVariants: Number(value) || 1 })
                      }
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {settingsOptions.variantCounts.map((count) => (
                          <SelectItem key={count} value={String(count)} className="text-xs">
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <TooltipProvider>
              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                        connectedData.images.length
                          ? "bg-blue-50"
                          : hasImageConnections
                          ? "bg-amber-50"
                          : "bg-gray-50"
                      }`}
                    >
                      <Image className="w-3 h-3 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">
                        {connectedData.images.length}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {hasImageConnections
                        ? `${connectedData.images.length} connected image${
                            connectedData.images.length === 1 ? "" : "s"
                          }`
                        : "No image nodes connected"}
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                        connectedData.prompt ? "bg-green-50" : "bg-gray-50"
                      }`}
                    >
                      <MessageSquare
                        className={`w-3 h-3 ${
                          connectedData.prompt
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span
                        className={`text-xs font-medium ${
                          connectedData.prompt
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
                  (connectedData.images.length === 0 && !connectedData.prompt)
                }
                size="sm"
                className="text-xs"
              >
                {isGenerating || generatedResult?.status === "generating" ? (
                  "Generating..."
                ) : (
                  <>
                    Generate
                    {estimatedImageCost ? (
                      <span className="ml-1 opacity-70">
                        · {Math.ceil(estimatedImageCost.credits)} cr
                      </span>
                    ) : null}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ModelCombobox
                options={availableModels}
                value={selectedModel}
                onValueChange={handleModelChange}
                placeholder="Select model…"
              />
            </div>
            {(settingsOptions.aspectRatios ||
              settingsOptions.imageSizes ||
              settingsOptions.imageResolutions ||
              settingsOptions.qualities ||
              settingsOptions.styles ||
              settingsOptions.renderingSpeeds ||
              settingsOptions.outputFormats ||
              settingsOptions.variantCounts) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSettings((v) => !v)}
                className="shrink-0 h-9 px-2 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                Settings
                {showSettings ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            )}
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

        {connectedData.prompt && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-foreground">Prompt:</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPrompt(!showPrompt)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <MessageCircle
                  className={`h-3 w-3 ${showPrompt ? "text-blue-600" : ""}`}
                />
              </Button>
            </div>
            {showPrompt && (
              <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded border">
                {connectedData.prompt}
              </div>
            )}
            <WildcardChip prompt={connectedData.prompt} model={selectedModel} />
          </div>
        )}

        {generatedResult && (
          <div className="space-y-2 border-t pt-2">
            <div className="text-xs font-medium text-foreground">
              Generated Result:
            </div>

            {generatedResult.status === "generating" && (
              <div className="text-xs text-blue-600">Generating...</div>
            )}

            {generatedResult.status === "error" && (
              <div className="text-xs text-red-600">
                Error: {generatedResult.error}
              </div>
            )}

            {/* Keep showing the previous successful image even after an error,
                so users don't lose context when a follow-up attempt fails. */}
            {(generatedResult.status === "completed" ||
              generatedResult.status === "error") &&
              generatedImageUrls.length > 0 && (
                <div className="space-y-2">
                  <div className="relative group">
                    <NextImage
                      src={generatedImageUrls[activeGeneratedImageIndex]}
                      alt="Generated image"
                      width={320}
                      height={320}
                      className="w-full max-w-[320px] h-auto object-cover rounded border"
                    />
                    <div className="nodrag absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditorOpen(true);
                        }}
                        className="h-8 w-8 p-0 bg-background/90 hover:bg-accent border cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadImage(
                            generatedImageUrls[activeGeneratedImageIndex],
                            generatedResult.prompt
                          );
                        }}
                        className="h-8 w-8 p-0 bg-background/90 hover:bg-accent border cursor-pointer"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {generatedMediaIds[activeGeneratedImageIndex] && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pinPending}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const mediaId =
                                generatedMediaIds[activeGeneratedImageIndex];
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
                              pinnedMediaIds.has(
                                generatedMediaIds[activeGeneratedImageIndex],
                              )
                                ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                                : "bg-background/90 hover:bg-accent border cursor-pointer"
                            }`}
                            title={
                              pinnedMediaIds.has(
                                generatedMediaIds[activeGeneratedImageIndex],
                              )
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
                              const mediaId =
                                generatedMediaIds[activeGeneratedImageIndex];
                              if (mediaId) {
                                canvasHost.track("generation.variations_clicked", {
                                  parentMediaId: mediaId,
                                  kind: "image",
                                  requested: 4,
                                });
                                runVariationsFromNode(mediaId, 4);
                              }
                            }}
                            className="h-8 w-8 p-0 bg-background/90 hover:bg-accent border cursor-pointer"
                            title="Make 4 variations"
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {generatedImageUrls.length > 1 && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Variations ({generatedImageUrls.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {generatedImageUrls.map((url, index) => (
                          <button
                            key={`${url}-${index}`}
                            type="button"
                            onClick={() => setActiveGeneratedImageIndex(index)}
                            className={`relative rounded border overflow-hidden ${
                              index === activeGeneratedImageIndex
                                ? "ring-2 ring-blue-500"
                                : "hover:ring-1 hover:ring-blue-300"
                            }`}
                          >
                            <NextImage
                              src={url}
                              alt={`Generated variation ${index + 1}`}
                              width={56}
                              height={56}
                              className="w-14 h-14 object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-foreground">
                        Generated Prompt:
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setShowGeneratedPrompt(!showGeneratedPrompt)
                        }
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <MessageCircle
                          className={`h-3 w-3 ${
                            showGeneratedPrompt ? "text-blue-600" : ""
                          }`}
                        />
                      </Button>
                    </div>
                    {showGeneratedPrompt && (
                      <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded border">
                        {generatedResult.prompt}
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {generatedImageUrls.length > 0 && editorOpen && (
        <ImageEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          imageUrl={generatedImageUrls[activeGeneratedImageIndex]}
          fileName="generated-image"
          boardId={boardId ?? ""}
          onSave={({ url, blobPath, size, fileName: editedName }) => {
            const sourceNode = getNodeById(id);
            const sourcePosition = sourceNode?.position ?? { x: 100, y: 100 };

            createNodeWithType("imageNode", undefined, {
              position: {
                x: sourcePosition.x + 340,
                y: sourcePosition.y + 40,
              },
              data: {
                label: "Edited Image",
                alt: "Edited generated image",
                imageUrl: url,
                fileName: editedName,
                blobPath,
                fileSize: size,
              },
            });
          }}
        />
      )}
    </NodeBox>
  );
}

export default OutputNode;
