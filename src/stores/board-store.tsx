"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  ReactFlowInstance,
  Viewport,
} from "@xyflow/react";
import { createStore, type StoreApi } from "zustand";
import { useStore } from "zustand";
import { createId } from "@paralleldrive/cuid2";

import type { VideoModelSettings } from "../lib/video-models";
import { useCanvasHost, type CanvasHost } from "../components/canvas-host/context";
import type { GenerationFeature } from "../lib/host/features";
import { notifyDialog } from "../components/ui/dialog-host";

const DEFAULT_HORIZONTAL_SPACING = 400;
const DEFAULT_VERTICAL_SPACING = 250;
const DEFAULT_BASE_X = 100;
const DEFAULT_BASE_Y = 100;
const EDGE_DASH = "5,5";
const EDGE_COLORS: Record<BoardNodeType, string> = {
  inputNode: "#10b981",
  imageNode: "#f59e0b",
  promptNode: "#0ea5e9",
  outputNode: "#f97316",
  videoNode: "#8b5cf6",
  seedNode: "#ec4899",
  upscaleNode: "#10b981",
  removeBgNode: "#06b6d4",
  faceConsistencyNode: "#e11d48",
};

const getEdgeStyle = (sourceType?: BoardNodeType | null) => ({
  stroke: sourceType ? EDGE_COLORS[sourceType] : "#94a3b8",
  strokeWidth: 1.5,
  strokeDasharray: EDGE_DASH,
});

const applyEdgeStyle = (edge: Edge, nodes: Node[]) => {
  if (edge.style?.stroke) {
    return edge;
  }
  const sourceNode = nodes.find((node) => node.id === edge.source);
  const style = getEdgeStyle((sourceNode?.type as BoardNodeType) ?? null);
  return {
    ...edge,
    style: {
      ...style,
      ...(edge.style ?? {}),
    },
  };
};

export type BoardNodeType =
  | "inputNode"
  | "imageNode"
  | "promptNode"
  | "outputNode"
  | "videoNode"
  | "seedNode"
  | "upscaleNode"
  | "removeBgNode"
  | "faceConsistencyNode";

interface BoardStoreConfig {
  boardId?: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  host: CanvasHost;
}

type ImageModelSettings = {
  aspectRatio?: string;
  imageSize?: string;
  imageResolution?: string;
  quality?: string;
  style?: string;
  renderingSpeed?: string;
  outputFormat?: string;
  nVariants?: number;
};

type GenerationApiResult = {
  success?: boolean;
  error?: string;
  upgradeRequired?: boolean;
  feature?: GenerationFeature;
  plan?: string;
  prompt?: unknown;
  imageUrl?: unknown;
  imageUrls?: unknown;
  imageId?: unknown;
  imageIds?: unknown;
  videoUrl?: unknown;
  videoId?: unknown;
  sizeBytes?: unknown;
  runGroupId?: unknown;
  mediaIds?: unknown;
};

interface BoardState {
  boardId?: string;
  nodes: Node[];
  edges: Edge[];
  reactFlowInstance: ReactFlowInstance | null;
  currentViewport?: Viewport;
  getNodeById: (id: string) => Node | undefined;
  getNodesByIds: (ids: string[]) => Node[];
  isInitialized: boolean;
  isSaving: boolean;
  lastSaveError: string | null;
  lastSavedAt: number | null;
  lastSaveDuration?: number | null;
  setReactFlowInstance: (instance: ReactFlowInstance | null) => void;
  setViewport: (viewport: Viewport) => void;
  fitView: (padding?: number) => void;
  loadInitialState: (nodes?: Node[], edges?: Edge[]) => void;
  handleNodesChange: (changes: NodeChange[]) => void;
  handleEdgesChange: (changes: EdgeChange[]) => void;
  handleConnect: (connection: Connection) => void;
  deleteNode: (nodeId: string) => void;
  createNodeWithType: (
    nodeType: BoardNodeType,
    viewport?: Viewport,
    options?: {
      position?: { x: number; y: number };
      data?: Record<string, unknown>;
    }
  ) => string;
  addInputNode: (viewport?: Viewport) => void;
  addImageNode: (viewport?: Viewport) => void;
  addPromptNode: (viewport?: Viewport) => void;
  addOutputNode: (viewport?: Viewport) => void;
  addVideoNode: (viewport?: Viewport) => void;
  addSeedNode: (viewport?: Viewport) => void;
  addUpscaleNode: (viewport?: Viewport) => void;
  addRemoveBgNode: (viewport?: Viewport) => void;
  addFaceConsistencyNode: (viewport?: Viewport) => void;
  updateNodeData: (
    nodeId: string,
    data: Record<string, unknown>
  ) => void;
  removeEdgeById: (edgeId: string) => void;
  removeEdgesByConnection: (connection: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) => void;
  // Clone an output/video node and all its incoming edges, position the
  // clone next to the source, and return the new node's id. Used when the
  // user clicks "Generate" on a node that already has a completed result —
  // forking preserves the previous output on the canvas instead of
  // overwriting it.
  forkOutputNodeForRegen: (sourceNodeId: string) => string | null;
  generateImage: (
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
      settings?: ImageModelSettings;
    },
    opts?: {
      parentMediaId?: string;
      chatMessageId?: string;
      source?: "node" | "chat";
      variants?: number;
    }
  ) => Promise<void>;
  cancelImageGeneration: (nodeId: string) => void;
  generateVideo: (
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
    },
    opts?: {
      parentMediaId?: string;
      chatMessageId?: string;
      source?: "node" | "chat";
      variants?: number;
    }
  ) => Promise<void>;
  cancelVideoGeneration: (nodeId: string) => void;
  runVariationsFromNode: (mediaId: string, variants?: number) => Promise<void>;
  runBulkGeneration: (input: {
    boardId: string;
    nodeId: string;
    prompt: string;
    model: string;
    settings: Record<string, unknown>;
    images?: Array<{
      imageUrl: string;
      nodeId?: string;
      blobPath?: string;
    }>;
  }) => Promise<{ success: boolean; bulkRunId?: string; error?: string }>;
}

export type BoardStore = StoreApi<BoardState>;

const BoardStoreContext = createContext<BoardStore | null>(null);

function sanitizeGraph<T>(graph: T): T {
  return JSON.parse(JSON.stringify(graph));
}

function ensureArray<T>(value?: unknown): T[] | undefined {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return undefined;
}

async function parseApiJsonResponse(response: Response): Promise<{
  payload: unknown | null;
  parseError?: string;
}> {
  const contentType = response.headers.get("content-type") || "";
  const responseText = await response.text();

  if (!responseText.trim()) {
    return { payload: {} };
  }

  try {
    const parsed = JSON.parse(responseText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        payload: null,
        parseError: "Unexpected response format from server.",
      };
    }
    return { payload: parsed };
  } catch {
    const isHtml =
      contentType.includes("text/html") ||
      responseText.trimStart().startsWith("<!DOCTYPE") ||
      responseText.trimStart().startsWith("<html");

    if (isHtml) {
      return {
        payload: null,
        parseError: "Session expired. Please sign in again and retry.",
      };
    }

    return {
      payload: null,
      parseError: "Invalid JSON response from server.",
    };
  }
}

function createBoardStore({
  boardId,
  initialNodes,
  initialEdges,
  host,
}: BoardStoreConfig): BoardStore {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const imageGenerationControllers = new Map<string, AbortController>();
  const imagePollIntervals = new Map<string, ReturnType<typeof setInterval>>();
  const imageJobIdByNode = new Map<string, string>();
  const imagePollResumed = new Set<string>();
  const imagePollStartedAt = new Map<string, number>();
  const IMAGE_POLL_MAX_MS = 10 * 60_000;
  const videoGenerationControllers = new Map<string, AbortController>();
  const videoPollIntervals = new Map<string, ReturnType<typeof setInterval>>();
  const videoJobIdByNode = new Map<string, string>();
  const videoPollResumed = new Set<string>();

  const store = createStore<BoardState>()((set, get) => {
    const attachCallbacks = (node: Node): Node => {
      const storeState = get();

      // If callbacks are already attached, avoid recreating the node object
      // to preserve reference equality and prevent excessive React re-renders.
      if (node.data && node.data.onDelete === storeState.deleteNode) {
        return node;
      }

      const {
        deleteNode,
        generateImage,
        cancelImageGeneration,
        generateVideo,
        cancelVideoGeneration,
        createNodeWithType,
      } = storeState;

      const data = {
        ...(node.data || {}),
        onDelete: deleteNode,
        onCreateNode: createNodeWithType,
      } as Record<string, unknown>;

      if (node.type === "outputNode") {
        data.onGenerate = generateImage;
        data.onCancelGenerate = cancelImageGeneration;
      }
      if (node.type === "videoNode") {
        data.onGenerate = generateVideo;
        data.onCancelGenerate = cancelVideoGeneration;
      }

      return {
        ...node,
        data,
      };
    };

    const attachCallbacksToNodes = (nodes: Node[]) =>
      nodes.map(attachCallbacks);

    const createDefaultWorkflow = () => {
      const timestamp = Date.now();
      const inputNodeId = `input-${timestamp}`;
      const outputNodeId = `output-${timestamp}`;

      const inputNode: Node = {
        id: inputNodeId,
        type: "inputNode",
        position: { x: DEFAULT_BASE_X, y: DEFAULT_BASE_Y },
        data: {
          label: "Input",
        },
      };

      const outputNode: Node = {
        id: outputNodeId,
        type: "outputNode",
        position: {
          x: DEFAULT_BASE_X + DEFAULT_HORIZONTAL_SPACING,
          y: DEFAULT_BASE_Y,
        },
        data: {
          label: "AI Output",
        },
      };

      const inputToOutput: Edge = {
        id: `edge-input-output-${timestamp}`,
        source: inputNodeId,
        target: outputNodeId,
        targetHandle: "input",
        type: "default",
        style: getEdgeStyle("inputNode"),
      };

      return {
        nodes: attachCallbacksToNodes([inputNode, outputNode]),
        edges: [inputToOutput],
      };
    };

    const scheduleSaveDebounced = (
      nodesSnapshot: Node[],
      edgesSnapshot: Edge[]
    ) => {
      const currentBoardId = get().boardId;
      if (!currentBoardId) return;

      if (saveTimer) {
        clearTimeout(saveTimer);
      }

      const nodesCopy = sanitizeGraph(nodesSnapshot);
      const edgesCopy = sanitizeGraph(edgesSnapshot);

      saveTimer = setTimeout(async () => {
        if (!nodesCopy.length) {
          return;
        }

        try {
          const startTime = performance.now();
          set((state) => ({ ...state, isSaving: true, lastSaveError: null }));

          await host.actions.updateBoard(currentBoardId, {
            nodes: nodesCopy,
            edges: edgesCopy,
          });

          const duration = performance.now() - startTime;

          set((state) => ({
            ...state,
            isSaving: false,
            lastSavedAt: Date.now(),
            lastSaveDuration: duration,
          }));
        } catch (error) {
          set((state) => ({
            ...state,
            isSaving: false,
            lastSaveError:
              error instanceof Error ? error.message : "Failed to save board",
          }));
        }
      }, 1000);
    };

    const handleNodeInsertion = (
      producer: (currentNodes: Node[]) => Node[]
    ) => {
      set((state) => {
        const nextNodes = attachCallbacksToNodes(producer(state.nodes));
        scheduleSaveDebounced(nextNodes, state.edges);
        return {
          ...state,
          nodes: nextNodes,
        };
      });
    };

    const handleEdgeInsertion = (
      producer: (currentEdges: Edge[]) => Edge[]
    ) => {
      set((state) => {
        const nextEdges = producer(state.edges);
        scheduleSaveDebounced(state.nodes, nextEdges);
        return {
          ...state,
          edges: nextEdges,
        };
      });
    };

    const createNodeByType = (
      nodeType: BoardNodeType,
      viewport?: Viewport,
      positionOverride?: { x: number; y: number }
    ): Node => {
      const timestamp = Date.now();

      // Calculate position near the CENTER of the current screen in flow coords (accounts for pan/zoom)
      let position = positionOverride ?? { x: DEFAULT_BASE_X, y: DEFAULT_BASE_Y };
      const instance = get().reactFlowInstance;
      const effectiveViewport = viewport || get().currentViewport;

      const randomOffsetX = Math.round(Math.random() * 100) - 50; // -50..+50
      const randomOffsetY = Math.round(Math.random() * 100) - 50; // -50..+50

      if (typeof window !== "undefined" && viewport) {
        // Fallback: convert screen center using viewport transform
        const zoom = viewport.zoom || 1;
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        position = {
          x: (screenCenterX - viewport.x) / zoom + randomOffsetX,
          y: (screenCenterY - viewport.y) / zoom + randomOffsetY,
        };
      } else if (
        typeof window !== "undefined" &&
        instance?.screenToFlowPosition
      ) {
        // Use instance conversion as a general fallback
        const centerScreen = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        };
        const projected = instance.screenToFlowPosition(centerScreen);
        position = {
          x: projected.x + randomOffsetX,
          y: projected.y + randomOffsetY,
        };
      } else if (typeof window !== "undefined" && effectiveViewport) {
        const zoom = effectiveViewport.zoom || 1;
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        position = {
          x: (screenCenterX - effectiveViewport.x) / zoom + randomOffsetX,
          y: (screenCenterY - effectiveViewport.y) / zoom + randomOffsetY,
        };
      } else {
        // Last resort: near default base
        position = {
          x: DEFAULT_BASE_X + randomOffsetX,
          y: DEFAULT_BASE_Y + randomOffsetY,
        };
      }

      switch (nodeType) {
        case "imageNode":
          return {
            id: `image-${timestamp}`,
            type: "imageNode",
            position,
            data: {
              label: "New Image",
              alt: "New image node",
            },
          };
        case "promptNode":
          return {
            id: `prompt-${timestamp}`,
            type: "promptNode",
            position,
            data: {
              label: "New Prompt",
            },
          };
        case "outputNode":
          return {
            id: `output-${timestamp}`,
            type: "outputNode",
            position,
            data: {
              label: "New Output",
            },
          };
        case "videoNode":
          return {
            id: `video-${timestamp}`,
            type: "videoNode",
            position,
            data: {
              label: "New Video",
            },
          };
        case "seedNode":
          return {
            id: `seed-${timestamp}`,
            type: "seedNode",
            position,
            data: {
              label: "Seed Frame",
            },
          };
        case "upscaleNode":
          return {
            id: `upscale-${timestamp}`,
            type: "upscaleNode",
            position,
            data: { label: "Upscale", factor: 2 },
          };
        case "removeBgNode":
          return {
            id: `removebg-${timestamp}`,
            type: "removeBgNode",
            position,
            data: { label: "Remove BG" },
          };
        case "faceConsistencyNode":
          return {
            id: `facecon-${timestamp}`,
            type: "faceConsistencyNode",
            position,
            data: { label: "Face Consistency" },
          };
        default:
          return {
            id: `${nodeType}-${timestamp}`,
            type: nodeType,
            position,
            data: {
              label: "Node",
            },
          };
      }
    };

    const applyVideoErrorToNode = (nodeId: string, error: string) => {
      set((state) => {
        const nextNodes = state.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...(node.data || {}),
                  result: {
                    ...(node.data?.result || {}),
                    status: "error",
                    error,
                  },
                },
              }
            : node
        );
        scheduleSaveDebounced(nextNodes, state.edges);
        return { ...state, nodes: nextNodes };
      });
      const interval = videoPollIntervals.get(nodeId);
      if (interval) {
        clearInterval(interval);
        videoPollIntervals.delete(nodeId);
      }
      videoJobIdByNode.delete(nodeId);
    };

    const applyVideoCompletionToNode = (
      nodeId: string,
      status: {
        videoUrl?: string;
        blobPath?: string;
        mediaId?: string;
        runGroupId?: string | null;
        fileSize?: number | null;
        fileName?: string | null;
        prompt?: string;
      },
      requestedVariants: number,
    ) => {
      const generatedFileName =
        status.fileName ??
        (status.blobPath
          ? status.blobPath.split("/").pop() || "generated-video"
          : "generated-video");
      const generatedSize = status.fileSize ?? undefined;
      const runGroupId = status.runGroupId ?? null;
      const mediaIds = status.mediaId ? [status.mediaId] : [];

      host.track("generation.run_group_size_succeeded", {
        requested: requestedVariants,
        succeeded: status.videoUrl ? 1 : 0,
        kind: "video",
      });

      set((state) => {
        const nextNodes = state.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const existingModel =
            ((node.data ?? {}) as { selectedModel?: string }).selectedModel ??
            ((node.data ?? {}) as {
              result?: { model?: string };
            }).result?.model;
          const nextResult = {
            videoUrl: status.videoUrl,
            prompt: status.prompt,
            status: "completed",
            fileName: generatedFileName,
            fileSize: generatedSize,
            runGroupId,
            mediaIds,
            // Tag the result with the model that produced it so the node
            // preview can hide stale results when the user switches model.
            model: existingModel,
          };
          const nextData: Record<string, unknown> = {
            ...(node.data || {}),
            result: nextResult,
            runGroupId,
            mediaIds,
          };
          if (status.videoUrl) {
            nextData["videoUrl"] = status.videoUrl;
            nextData["fileName"] = generatedFileName;
            nextData["blobPath"] =
              status.blobPath ?? (nextData["blobPath"] as string | undefined);
            nextData["fileSize"] = generatedSize;
          }
          return { ...node, data: nextData };
        });
        scheduleSaveDebounced(nextNodes, state.edges);
        return { ...state, nodes: nextNodes };
      });

      const interval = videoPollIntervals.get(nodeId);
      if (interval) {
        clearInterval(interval);
        videoPollIntervals.delete(nodeId);
      }
      videoJobIdByNode.delete(nodeId);
      host.onGenerationSettled();
    };

    const pollOnceVideoJob = async (
      nodeId: string,
      jobId: string,
      requestedVariants: number,
    ) => {
      let response: Response;
      try {
        response = await fetch(`/api/generate-video/${jobId}`, {
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        return;
      }
      if (response.status === 404) {
        applyVideoErrorToNode(nodeId, "Video job not found");
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as {
        status: "pending" | "processing" | "completed" | "failed" | "cancelled";
        videoUrl?: string;
        blobPath?: string;
        mediaId?: string;
        runGroupId?: string | null;
        fileSize?: number | null;
        fileName?: string | null;
        prompt?: string;
        error?: string;
      };
      if (data.status === "completed") {
        applyVideoCompletionToNode(nodeId, data, requestedVariants);
        return;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        applyVideoErrorToNode(
          nodeId,
          data.error ||
            (data.status === "cancelled"
              ? "Generation canceled"
              : "Video generation failed"),
        );
        return;
      }
      // pending / processing — keep polling
    };

    const startPollingVideoJob = (
      nodeId: string,
      jobId: string,
      requestedVariants: number,
    ) => {
      const existing = videoPollIntervals.get(nodeId);
      if (existing) clearInterval(existing);
      // Kick off an immediate poll, then every 3 seconds.
      void pollOnceVideoJob(nodeId, jobId, requestedVariants);
      const interval = setInterval(() => {
        void pollOnceVideoJob(nodeId, jobId, requestedVariants);
      }, 3000);
      videoPollIntervals.set(nodeId, interval);
    };

    const resumeInFlightVideoPolls = () => {
      for (const node of get().nodes) {
        if (node.type !== "videoNode") continue;
        if (videoPollResumed.has(node.id)) continue;
        const data = (node.data ?? {}) as {
          result?: { status?: string; jobId?: string };
        };
        if (
          data.result?.status === "generating" &&
          typeof data.result?.jobId === "string"
        ) {
          videoPollResumed.add(node.id);
          videoJobIdByNode.set(node.id, data.result.jobId);
          startPollingVideoJob(node.id, data.result.jobId, 1);
        }
      }
    };

    const applyImageErrorToNode = (nodeId: string, error: string) => {
      set((state) => {
        const nextNodes = state.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...(node.data || {}),
                  result: {
                    ...(node.data?.result || {}),
                    status: "error",
                    error,
                  },
                },
              }
            : node
        );
        scheduleSaveDebounced(nextNodes, state.edges);
        return { ...state, nodes: nextNodes };
      });
      const interval = imagePollIntervals.get(nodeId);
      if (interval) {
        clearInterval(interval);
        imagePollIntervals.delete(nodeId);
      }
      imageJobIdByNode.delete(nodeId);
      imagePollStartedAt.delete(nodeId);
    };

    const applyImageCompletionToNode = (
      nodeId: string,
      status: {
        imageUrls?: string[];
        media?: Array<{
          id: string;
          url: string;
          blobPath: string | null;
          fileName: string | null;
          fileSize: number | null;
        }>;
        mediaIds?: string[];
        runGroupId?: string | null;
        prompt?: string;
      },
      requestedVariants: number,
    ) => {
      const firstUrl = status.imageUrls?.[0];
      const firstMedia = status.media?.[0];
      const generatedFileName =
        firstMedia?.fileName ??
        (firstMedia?.blobPath?.split("/").pop() || "generated-image");
      const generatedSize = firstMedia?.fileSize ?? undefined;
      const blobPath = firstMedia?.blobPath ?? undefined;
      const runGroupId = status.runGroupId ?? null;
      const mediaIds = status.mediaIds ?? [];

      host.track("generation.run_group_size_succeeded", {
        requested: requestedVariants,
        succeeded: status.imageUrls?.length ?? 0,
        kind: "image",
      });

      set((state) => {
        const nextNodes = state.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const nextResult = {
            imageUrl: firstUrl,
            imageUrls: status.imageUrls,
            prompt: status.prompt,
            status: "completed",
            fileName: generatedFileName,
            fileSize: generatedSize,
            runGroupId,
            mediaIds,
          };
          const nextData: Record<string, unknown> = {
            ...(node.data || {}),
            result: nextResult,
            runGroupId,
            mediaIds,
          };
          if (firstUrl) {
            nextData["imageUrl"] = firstUrl;
            nextData["fileName"] = generatedFileName;
            nextData["blobPath"] =
              blobPath ?? (nextData["blobPath"] as string | undefined);
            nextData["fileSize"] = generatedSize;
          }
          return { ...node, data: nextData };
        });
        scheduleSaveDebounced(nextNodes, state.edges);
        return { ...state, nodes: nextNodes };
      });

      const interval = imagePollIntervals.get(nodeId);
      if (interval) {
        clearInterval(interval);
        imagePollIntervals.delete(nodeId);
      }
      imageJobIdByNode.delete(nodeId);
      imagePollStartedAt.delete(nodeId);
      host.onGenerationSettled();
    };

    const pollOnceImageJob = async (
      nodeId: string,
      jobId: string,
      requestedVariants: number,
    ) => {
      const startedAt = imagePollStartedAt.get(nodeId);
      if (startedAt && Date.now() - startedAt > IMAGE_POLL_MAX_MS) {
        applyImageErrorToNode(
          nodeId,
          "Generation took too long. Refresh to check.",
        );
        return;
      }
      let response: Response;
      try {
        response = await fetch(`/api/generate-image/${jobId}`, {
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        return;
      }
      if (response.status === 404) {
        applyImageErrorToNode(nodeId, "Image job not found");
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as {
        status: "pending" | "processing" | "completed" | "failed" | "cancelled";
        imageUrls?: string[];
        media?: Array<{
          id: string;
          url: string;
          blobPath: string | null;
          fileName: string | null;
          fileSize: number | null;
        }>;
        mediaIds?: string[];
        runGroupId?: string | null;
        prompt?: string;
        error?: string;
      };
      if (data.status === "completed") {
        applyImageCompletionToNode(nodeId, data, requestedVariants);
        return;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        applyImageErrorToNode(
          nodeId,
          data.error ||
            (data.status === "cancelled"
              ? "Generation canceled"
              : "Image generation failed"),
        );
        return;
      }
      // pending / processing — keep polling
    };

    const startPollingImageJob = (
      nodeId: string,
      jobId: string,
      requestedVariants: number,
    ) => {
      const existing = imagePollIntervals.get(nodeId);
      if (existing) clearInterval(existing);
      imagePollStartedAt.set(nodeId, Date.now());
      void pollOnceImageJob(nodeId, jobId, requestedVariants);
      const interval = setInterval(() => {
        void pollOnceImageJob(nodeId, jobId, requestedVariants);
      }, 3000);
      imagePollIntervals.set(nodeId, interval);
    };

    const resumeInFlightImagePolls = () => {
      for (const node of get().nodes) {
        if (node.type !== "outputNode") continue;
        if (imagePollResumed.has(node.id)) continue;
        const data = (node.data ?? {}) as {
          result?: { status?: string; jobId?: string };
        };
        if (
          data.result?.status === "generating" &&
          typeof data.result?.jobId === "string"
        ) {
          imagePollResumed.add(node.id);
          imageJobIdByNode.set(node.id, data.result.jobId);
          startPollingImageJob(node.id, data.result.jobId, 1);
        }
      }
    };

    return {
      boardId,
      nodes: [],
      edges: [],
      reactFlowInstance: null,
      currentViewport: undefined,
      isInitialized: false,
      isSaving: false,
      lastSaveError: null,
      lastSavedAt: null,
      lastSaveDuration: null,
      setReactFlowInstance: (instance) => {
        set((state) => ({ ...state, reactFlowInstance: instance }));
      },
      setViewport: (viewport) => {
        set((state) => ({ ...state, currentViewport: viewport }));
      },
      getNodeById: (nodeId) => get().nodes.find((node) => node.id === nodeId),
      getNodesByIds: (ids) =>
        get().nodes.filter((node) => ids.includes(node.id)),
      fitView: (padding = 0.1) => {
        const instance = get().reactFlowInstance;
        if (!instance) return;

        window.setTimeout(() => {
          instance.fitView({ padding });
        }, 100);
      },
      loadInitialState: (nodesInput, edgesInput) => {
        const preparedNodes = ensureArray<Node>(nodesInput);
        const preparedEdges = ensureArray<Edge>(edgesInput);

        if (preparedNodes && preparedNodes.length) {
          const nextNodes = attachCallbacksToNodes(
            preparedNodes.map((node) => ({
              ...node,
              data: { ...(node.data || {}) },
            }))
          );
          const nextEdges = preparedEdges
            ? preparedEdges.map((edge) => applyEdgeStyle({ ...edge }, nextNodes))
            : [];

          set((state) => ({
            ...state,
            nodes: nextNodes,
            edges: nextEdges,
            isInitialized: true,
          }));
        } else {
          const defaults = createDefaultWorkflow();
          set((state) => ({
            ...state,
            nodes: defaults.nodes,
            edges: defaults.edges,
            isInitialized: true,
          }));
        }
        resumeInFlightVideoPolls();
        resumeInFlightImagePolls();
      },
      handleNodesChange: (changes) => {
        set((state) => {
          const nextNodes = attachCallbacksToNodes(
            applyNodeChanges(changes, state.nodes)
          );
          const nextEdges = state.edges;
          scheduleSaveDebounced(nextNodes, nextEdges);
          return {
            ...state,
            nodes: nextNodes,
          };
        });
      },
      handleEdgesChange: (changes) => {
        set((state) => {
          const nextEdges = applyEdgeChanges(changes, state.edges);
          scheduleSaveDebounced(state.nodes, nextEdges);
          return {
            ...state,
            edges: nextEdges,
          };
        });
      },
      handleConnect: (connection) => {
        handleEdgeInsertion((edgesSnapshot) => {
          const params: Connection = { ...connection };
          const nodes = get().nodes;
          const sourceNode = nodes.find((n) => n.id === params.source);
          const targetNode = nodes.find((n) => n.id === params.target);

          if (
            targetNode?.type === "outputNode" ||
            targetNode?.type === "videoNode" ||
            targetNode?.type === "faceConsistencyNode"
          ) {
            if (sourceNode?.type === "inputNode") {
              params.targetHandle = "input";
            } else if (sourceNode?.type === "promptNode") {
              params.targetHandle = "prompt";
            } else {
              params.targetHandle = "images";
            }
          } else if (!params.targetHandle) {
            if (sourceNode?.type === "promptNode") {
              params.targetHandle = "prompt";
            } else if (
              sourceNode?.type === "imageNode" ||
              sourceNode?.type === "inputNode" ||
              sourceNode?.type === "outputNode" ||
              sourceNode?.type === "videoNode"
            ) {
              params.targetHandle = "images";
            }
          }

          const styledEdge = {
            ...params,
            type: "default",
            style: getEdgeStyle((sourceNode?.type as BoardNodeType) ?? null),
          } as Connection;

          return addEdge(styledEdge, edgesSnapshot);
        });
      },
      deleteNode: (nodeId) => {
        const activeImageGeneration = imageGenerationControllers.get(nodeId);
        if (activeImageGeneration) {
          activeImageGeneration.abort();
          imageGenerationControllers.delete(nodeId);
        }
        const activeVideoGeneration = videoGenerationControllers.get(nodeId);
        if (activeVideoGeneration) {
          activeVideoGeneration.abort();
          videoGenerationControllers.delete(nodeId);
        }

        const boardId = get().boardId;
        const targetNode = get().nodes.find((node) => node.id === nodeId);

        if (boardId && targetNode) {
          const payload = (targetNode.data ?? {}) as {
            blobPath?: string;
            fileSize?: number;
            result?: {
              blobPath?: string;
              fileSize?: number;
            };
          };

          const blobPath = payload.blobPath || payload.result?.blobPath;
          const fileSize = payload.fileSize ?? payload.result?.fileSize ?? 0;

          if (blobPath && fileSize) {
            const params = new URLSearchParams();
            params.set("boardId", boardId);
            params.set("previousBlobPath", blobPath);
            params.set("previousSize", String(fileSize));

            fetch(`/api/upload-image?${params.toString()}`, {
              method: "DELETE",
            }).catch(() => {});
          }
        }

        set((state) => {
          const nextNodes = state.nodes.filter((node) => node.id !== nodeId);
          const nextEdges = state.edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          );
          scheduleSaveDebounced(nextNodes, nextEdges);
          return {
            ...state,
            nodes: nextNodes,
            edges: nextEdges,
          };
        });
      },
      createNodeWithType: (nodeType, viewport, options) => {
        const newNode = attachCallbacks(
          createNodeByType(nodeType, viewport, options?.position)
        );
        if (options?.data) {
          newNode.data = {
            ...(newNode.data || {}),
            ...options.data,
          };
        }
        handleNodeInsertion((nodesSnapshot) => [...nodesSnapshot, newNode]);
        get().fitView();
        return newNode.id;
      },
      addInputNode: (viewport) => {
        get().createNodeWithType("inputNode", viewport);
      },
      addImageNode: (viewport) => {
        get().createNodeWithType("imageNode", viewport);
      },
      addPromptNode: (viewport) => {
        get().createNodeWithType("promptNode", viewport);
      },
      addOutputNode: (viewport) => {
        get().createNodeWithType("outputNode", viewport);
      },
      addVideoNode: (viewport) => {
        get().createNodeWithType("videoNode", viewport);
      },
      addSeedNode: (viewport) => {
        get().createNodeWithType("seedNode", viewport);
      },
      addUpscaleNode: (viewport) => {
        get().createNodeWithType("upscaleNode", viewport);
      },
      addRemoveBgNode: (viewport) => {
        get().createNodeWithType("removeBgNode", viewport);
      },
      addFaceConsistencyNode: (viewport) => {
        get().createNodeWithType("faceConsistencyNode", viewport);
      },
      updateNodeData: (nodeId, data) => {
        set((state) => {
          const nextNodes = state.nodes.map((node) =>
            node.id === nodeId
              ? {
                ...node,
                data: {
                  ...(node.data || {}),
                  ...data,
                },
              }
              : node
          );
          scheduleSaveDebounced(nextNodes, state.edges);
          return {
            ...state,
            nodes: nextNodes,
          };
        });
      },
      removeEdgeById: (edgeId) => {
        set((state) => {
          const nextEdges = state.edges.filter((edge) => edge.id !== edgeId);
          scheduleSaveDebounced(state.nodes, nextEdges);
          return {
            ...state,
            edges: nextEdges,
          };
        });
      },
      removeEdgesByConnection: (connection) => {
        set((state) => {
          const nextEdges = state.edges.filter((edge) => {
            if (edge.source !== connection.source || edge.target !== connection.target) {
              return true;
            }

            if (
              connection.sourceHandle !== undefined &&
              connection.sourceHandle !== null &&
              edge.sourceHandle !== connection.sourceHandle
            ) {
              return true;
            }

            if (
              connection.targetHandle !== undefined &&
              connection.targetHandle !== null &&
              edge.targetHandle !== connection.targetHandle
            ) {
              return true;
            }

            return false;
          });
          scheduleSaveDebounced(state.nodes, nextEdges);
          return {
            ...state,
            edges: nextEdges,
          };
        });
      },
      forkOutputNodeForRegen: (sourceNodeId) => {
        const state = get();
        const source = state.nodes.find((n) => n.id === sourceNodeId);
        if (!source) return null;
        if (source.type !== "outputNode" && source.type !== "videoNode") {
          return null;
        }

        // Carry every persisted config field forward EXCEPT transient
        // per-run state. Denylist (vs allowlist) means new fields like
        // `seed` or `negativePrompt` get carried by default and we won't
        // silently drop them on fork.
        const sourceData = (source.data ?? {}) as Record<string, unknown>;
        const TRANSIENT_FIELDS = new Set([
          "result",
          "jobId",
          "mediaIds",
          "runGroupId",
          "videoUrl",
          "imageUrl",
          "blobPath",
          "fileName",
          "fileSize",
        ]);
        const cloneData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(sourceData)) {
          // Skip ReactFlow callbacks (re-attached via attachCallbacksToNodes)
          // and any transient run state.
          if (typeof value === "function") continue;
          if (TRANSIENT_FIELDS.has(key)) continue;
          cloneData[key] = value;
        }

        const NODE_FORK_OFFSET_X = 380;
        const NODE_FORK_OFFSET_Y = 80;
        const newNodeId = state.createNodeWithType(source.type, undefined, {
          position: {
            x: source.position.x + NODE_FORK_OFFSET_X,
            y: source.position.y + NODE_FORK_OFFSET_Y,
          },
          data: cloneData,
        });

        // Copy every incoming edge so the clone reads from the same prompt
        // / image inputs. Use createId() for new edge IDs to avoid clashes.
        const incomingEdges = state.edges.filter(
          (e) => e.target === sourceNodeId,
        );
        if (incomingEdges.length > 0) {
          set((current) => {
            const cloneEdges = incomingEdges.map((edge) => ({
              ...edge,
              id: `${edge.source}-${newNodeId}-${edge.targetHandle ?? "default"}-${createId()}`,
              target: newNodeId,
            }));
            const nextEdges = [...current.edges, ...cloneEdges];
            scheduleSaveDebounced(current.nodes, nextEdges);
            return { ...current, edges: nextEdges };
          });
        }

        return newNodeId;
      },
      generateImage: async (nodeId, connectedData, opts) => {
        const currentNodes = get().nodes;
        const nodeExists = currentNodes.some((node) => node.id === nodeId);
        if (!nodeExists) return;

        const boardId = get().boardId;
        if (!boardId) {
          console.error("Board ID missing; cannot generate image");
          return;
        }

        const targetNode = currentNodes.find((node) => node.id === nodeId);
        const nodePayload = (targetNode?.data ?? {}) as {
          blobPath?: string;
          fileSize?: number;
          result?: {
            blobPath?: string;
            fileSize?: number;
          };
        };

        const previousBlobPath =
          nodePayload.blobPath || nodePayload.result?.blobPath;
        const previousSize =
          nodePayload.fileSize ?? nodePayload.result?.fileSize ?? 0;

        set((state) => {
          const nextNodes = state.nodes.map((node) =>
            node.id === nodeId
              ? {
                ...node,
                data: {
                  ...(node.data || {}),
                  result: {
                    ...(node.data?.result || {}),
                    status: "generating",
                  },
                },
              }
              : node
          );
          scheduleSaveDebounced(nextNodes, state.edges);
          return {
            ...state,
            nodes: nextNodes,
          };
        });

        const prompt = connectedData?.prompt || "";
        const images = connectedData?.images || [];
        const baseSettings = connectedData?.settings;
        const settings =
          typeof opts?.variants === "number"
            ? ({
                ...(baseSettings ?? {}),
                nVariants: opts.variants,
              } as ImageModelSettings)
            : baseSettings;
        const model = connectedData?.model;
        const activeController = imageGenerationControllers.get(nodeId);
        if (activeController) {
          activeController.abort();
          imageGenerationControllers.delete(nodeId);
        }
        const controller = new AbortController();
        imageGenerationControllers.set(nodeId, controller);

        if (!prompt) {
          set((state) => {
            const nextNodes = state.nodes.map((node) =>
              node.id === nodeId
                ? {
                  ...node,
                  data: {
                    ...(node.data || {}),
                    result: {
                      ...(node.data?.result || {}),
                      status: "error",
                      error: "No prompt provided from connected nodes",
                    },
                  },
                }
                : node
            );
            scheduleSaveDebounced(nextNodes, state.edges);
            return {
              ...state,
              nodes: nextNodes,
            };
          });
          return;
        }

        const requestedVariants =
          typeof opts?.variants === "number"
            ? opts.variants
            : typeof (settings as { nVariants?: number } | undefined)?.nVariants ===
                "number"
              ? ((settings as { nVariants?: number }).nVariants as number)
              : 1;
        host.track("generation.variants_chosen", {
          count: requestedVariants,
          kind: "image",
          model: model ?? undefined,
        });

        try {
          const startResponse = await fetch("/api/generate-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              boardId,
              nodeId,
              prompt,
              images,
              model,
              settings,
              variants: requestedVariants,
              previousBlobPath,
              previousSize,
              parentMediaId: opts?.parentMediaId,
              chatMessageId: opts?.chatMessageId,
              source: opts?.source ?? "node",
            }),
          });

          const { payload, parseError } = await parseApiJsonResponse(startResponse);
          if (!payload) {
            applyImageErrorToNode(
              nodeId,
              parseError || "Failed to parse image generation response",
            );
            return;
          }

          const startResult = payload as GenerationApiResult & {
            jobId?: string;
          };
          // 429 = plan rate limit, 402 = out of credits. Both should bring
          // up the upgrade prompt — otherwise the user sees a generic error
          // and silently churns instead of converting.
          if (
            (startResponse.status === 429 || startResponse.status === 402) &&
            startResult?.upgradeRequired
          ) {
            host.onLimit({
              feature: startResult.feature ?? "IMAGE_GENERATION",
              plan: startResult.plan ?? null,
              kind:
                startResponse.status === 402 ? "out_of_credits" : "rate_limit",
              severity: "critical",
              message:
                startResult.error ??
                (startResponse.status === 402
                  ? "You've run out of credits — top up or upgrade to keep generating."
                  : "Image generation limit reached for your current plan."),
            });
          }

          if (!startResult.success || typeof startResult.jobId !== "string") {
            applyImageErrorToNode(
              nodeId,
              startResult.error || "Image generation failed",
            );
            return;
          }

          const jobId = startResult.jobId;
          imageJobIdByNode.set(nodeId, jobId);

          // Persist jobId on the node so a page reload can resume polling.
          set((state) => {
            const nextNodes = state.nodes.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    data: {
                      ...(node.data || {}),
                      result: {
                        ...(node.data?.result || {}),
                        status: "generating",
                        jobId,
                      },
                    },
                  }
                : node
            );
            scheduleSaveDebounced(nextNodes, state.edges);
            return { ...state, nodes: nextNodes };
          });

          startPollingImageJob(nodeId, jobId, requestedVariants);
          // Reservation happened server-side at job creation; refresh
          // sidebar now so users see credits go down without waiting for
          // the run to finish (~30s). On failure we'll refresh again at
          // completion to reflect the refund.
          host.onGenerationSettled();
        } catch (error) {
          const isAbort =
            error instanceof Error && error.name === "AbortError";
          applyImageErrorToNode(
            nodeId,
            isAbort
              ? "Generation canceled"
              : error instanceof Error
                ? error.message
                : "Network error occurred",
          );
        } finally {
          imageGenerationControllers.delete(nodeId);
        }
      },
      cancelImageGeneration: (nodeId) => {
        const controller = imageGenerationControllers.get(nodeId);
        if (controller) {
          controller.abort();
          imageGenerationControllers.delete(nodeId);
        }
        const interval = imagePollIntervals.get(nodeId);
        if (interval) {
          clearInterval(interval);
          imagePollIntervals.delete(nodeId);
        }
        const jobId =
          imageJobIdByNode.get(nodeId) ??
          (() => {
            const node = get().nodes.find((n) => n.id === nodeId);
            const data = (node?.data ?? {}) as {
              result?: { jobId?: string };
            };
            return typeof data.result?.jobId === "string"
              ? data.result.jobId
              : undefined;
          })();
        imageJobIdByNode.delete(nodeId);
        imagePollStartedAt.delete(nodeId);

        if (jobId) {
          fetch(`/api/generate-image/${jobId}`, {
            method: "DELETE",
            credentials: "include",
          }).catch(() => {});
        }

        set((state) => {
          const nextNodes = state.nodes.map((node) =>
            node.id === nodeId
              ? {
                ...node,
                data: {
                  ...(node.data || {}),
                  result: {
                    ...(node.data?.result || {}),
                    status: "error",
                    error: "Generation canceled",
                  },
                },
              }
              : node
          );
          scheduleSaveDebounced(nextNodes, state.edges);
          return {
            ...state,
            nodes: nextNodes,
          };
        });
      },
      generateVideo: async (nodeId, connectedData, opts) => {
        const currentNodes = get().nodes;
        const nodeExists = currentNodes.some((node) => node.id === nodeId);
        if (!nodeExists) return;

        const boardId = get().boardId;
        if (!boardId) {
          console.error("Board ID missing; cannot generate video");
          return;
        }

        const targetNode = currentNodes.find((node) => node.id === nodeId);
        const nodePayload = (targetNode?.data ?? {}) as {
          blobPath?: string;
          fileSize?: number;
          result?: {
            blobPath?: string;
            fileSize?: number;
          };
        };

        const previousBlobPath =
          nodePayload.blobPath || nodePayload.result?.blobPath;
        const previousSize =
          nodePayload.fileSize ?? nodePayload.result?.fileSize ?? 0;

        set((state) => {
          const nextNodes = state.nodes.map((node) =>
            node.id === nodeId
              ? {
                ...node,
                data: {
                  ...(node.data || {}),
                  result: {
                    ...(node.data?.result || {}),
                    status: "generating",
                  },
                },
              }
              : node
          );
          scheduleSaveDebounced(nextNodes, state.edges);
          return {
            ...state,
            nodes: nextNodes,
          };
        });

        const prompt = connectedData?.prompt || "";
        const images = connectedData?.images || [];
        const settings = connectedData?.settings;
        const activeController = videoGenerationControllers.get(nodeId);
        if (activeController) {
          activeController.abort();
          videoGenerationControllers.delete(nodeId);
        }
        const controller = new AbortController();
        videoGenerationControllers.set(nodeId, controller);

        if (!prompt) {
          set((state) => {
            const nextNodes = state.nodes.map((node) =>
              node.id === nodeId
                ? {
                  ...node,
                  data: {
                    ...(node.data || {}),
                    result: {
                      ...(node.data?.result || {}),
                      status: "error",
                      error: "No prompt provided from connected nodes",
                    },
                  },
                }
                : node
            );
            scheduleSaveDebounced(nextNodes, state.edges);
            return {
              ...state,
              nodes: nextNodes,
            };
          });
          videoGenerationControllers.delete(nodeId);
          return;
        }

        const requestedVideoVariants =
          typeof opts?.variants === "number" ? opts.variants : 1;
        host.track("generation.variants_chosen", {
          count: requestedVideoVariants,
          kind: "video",
          model: connectedData?.model || host.models.video[0]?.value || "",
        });

        try {
          const startResponse = await fetch("/api/generate-video", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              boardId,
              nodeId,
              prompt,
              images,
              model: connectedData?.model || host.models.video[0]?.value || "",
              settings,
              previousBlobPath,
              previousSize,
              parentMediaId: opts?.parentMediaId,
              chatMessageId: opts?.chatMessageId,
              source: opts?.source ?? "node",
            }),
          });

          const { payload, parseError } = await parseApiJsonResponse(startResponse);
          if (!payload) {
            applyVideoErrorToNode(
              nodeId,
              parseError || "Failed to parse video generation response",
            );
            return;
          }

          const startResult = payload as GenerationApiResult & {
            jobId?: string;
          };
          // 429 = plan rate limit, 402 = out of credits. Both should bring
          // up the upgrade prompt — otherwise the user sees a generic error
          // and silently churns instead of converting.
          if (
            (startResponse.status === 429 || startResponse.status === 402) &&
            startResult?.upgradeRequired
          ) {
            host.onLimit({
              feature: startResult.feature ?? "VIDEO_GENERATION",
              plan: startResult.plan ?? null,
              kind:
                startResponse.status === 402 ? "out_of_credits" : "rate_limit",
              severity: "critical",
              message:
                startResult.error ??
                (startResponse.status === 402
                  ? "You've run out of credits — top up or upgrade to keep generating."
                  : "Video generation limit reached for your current plan."),
            });
          }

          if (!startResult.success || typeof startResult.jobId !== "string") {
            applyVideoErrorToNode(
              nodeId,
              startResult.error || "Video generation failed",
            );
            return;
          }

          const jobId = startResult.jobId;
          videoJobIdByNode.set(nodeId, jobId);

          // Persist jobId on the node so a page reload can resume polling.
          set((state) => {
            const nextNodes = state.nodes.map((node) =>
              node.id === nodeId
                ? {
                  ...node,
                  data: {
                    ...(node.data || {}),
                    result: {
                      ...(node.data?.result || {}),
                      status: "generating",
                      jobId,
                    },
                  },
                }
                : node
            );
            scheduleSaveDebounced(nextNodes, state.edges);
            return { ...state, nodes: nextNodes };
          });

          startPollingVideoJob(nodeId, jobId, requestedVideoVariants);
          // Reservation happened server-side at job creation; refresh
          // sidebar now so users see credits go down without waiting for
          // the run to finish.
          host.onGenerationSettled();
        } catch (error) {
          const isAbort =
            error instanceof Error && error.name === "AbortError";
          applyVideoErrorToNode(
            nodeId,
            isAbort
              ? "Generation canceled"
              : error instanceof Error
                ? error.message
                : "Network error occurred",
          );
        } finally {
          videoGenerationControllers.delete(nodeId);
        }
      },
      cancelVideoGeneration: (nodeId) => {
        const controller = videoGenerationControllers.get(nodeId);
        if (controller) {
          controller.abort();
          videoGenerationControllers.delete(nodeId);
        }
        const interval = videoPollIntervals.get(nodeId);
        if (interval) {
          clearInterval(interval);
          videoPollIntervals.delete(nodeId);
        }
        const jobId =
          videoJobIdByNode.get(nodeId) ??
          (() => {
            const node = get().nodes.find((n) => n.id === nodeId);
            const data = (node?.data ?? {}) as {
              result?: { jobId?: string };
            };
            return typeof data.result?.jobId === "string"
              ? data.result.jobId
              : undefined;
          })();
        videoJobIdByNode.delete(nodeId);

        if (jobId) {
          // Fire-and-forget; the DELETE marks the job cancelled and refunds.
          fetch(`/api/generate-video/${jobId}`, {
            method: "DELETE",
            credentials: "include",
          }).catch(() => {});
        }

        set((state) => {
          const nextNodes = state.nodes.map((node) =>
            node.id === nodeId
              ? {
                ...node,
                data: {
                  ...(node.data || {}),
                  result: {
                    ...(node.data?.result || {}),
                    status: "error",
                    error: "Generation canceled",
                  },
                },
              }
              : node
          );
          scheduleSaveDebounced(nextNodes, state.edges);
          return {
            ...state,
            nodes: nextNodes,
          };
        });
      },
      runVariationsFromNode: async (mediaId, variants = 4) => {
        const result = await host.actions.runVariations(mediaId, variants);
        if (!result.success) {
          await notifyDialog({
            title: "Can't make variations",
            description: result.error,
          });
          return;
        }

        const targetNodeId = result.nodeId;
        if (!targetNodeId || !get().getNodeById(targetNodeId)) {
          await notifyDialog({
            title: "Source node not found",
            description:
              "The output node that produced this run no longer exists on the board. Re-add an output node to continue.",
          });
          return;
        }

        const connected = {
          prompt: result.snapshot.prompt,
          images: result.snapshot.images.map((image) => ({
            nodeId: image.nodeId ?? "",
            imageUrl: image.imageUrl,
            blobPath: image.blobPath,
          })),
          model: result.snapshot.model,
        };

        if (result.kind === "image") {
          await get().generateImage(targetNodeId, connected, {
            parentMediaId: result.parentMediaId,
            variants: result.snapshot.variants,
          });
        } else {
          await get().generateVideo(targetNodeId, connected, {
            parentMediaId: result.parentMediaId,
            variants: result.snapshot.variants,
          });
        }
      },
      runBulkGeneration: async (input) => {
        try {
          const response = await fetch("/api/generate-image/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            if (response.status === 402 && result?.upgradeRequired) {
              host.onLimit({
                feature: "IMAGE_GENERATION",
                plan: typeof result.plan === "string" ? result.plan : null,
                kind: "out_of_credits",
                severity: "critical",
                message: result.error ?? "Insufficient credits.",
              });
            } else {
              await notifyDialog({
                title: "Couldn't start bulk run",
                description:
                  result?.error ?? `Request failed (${response.status}).`,
              });
            }
            return {
              success: false,
              error: result?.error ?? `Request failed (${response.status}).`,
            };
          }
          host.track("bulk.submitted", {
            count: result.total,
            plan: "unknown",
            model: input.model,
          });
          host.onGenerationSettled();
          return { success: true, bulkRunId: result.bulkRunId };
        } catch (err) {
          await notifyDialog({
            title: "Network error",
            description:
              err instanceof Error ? err.message : "Unknown error",
          });
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    };
  });

  const initialNodesSafe = ensureArray<Node>(initialNodes) ?? [];
  const initialEdgesSafe = (ensureArray<Edge>(initialEdges) ?? []).filter((edge) => {
    const targetNode = initialNodesSafe.find((n) => n.id === edge.target);
    if (!targetNode) return false;
    return targetNode.type !== "imageNode" && targetNode.type !== "promptNode";
  });
  store.getState().loadInitialState(initialNodesSafe, initialEdgesSafe);

  return store;
}

interface BoardStoreProviderProps extends BoardStoreConfig {
  children: ReactNode;
}

export function BoardStoreProvider({
  boardId,
  initialNodes,
  initialEdges,
  children,
}: Omit<BoardStoreProviderProps, "host">) {
  const host = useCanvasHost();
  const storeRef = useRef<BoardStore | undefined>(undefined);

  if (!storeRef.current || storeRef.current.getState().boardId !== boardId) {
    storeRef.current = createBoardStore({
      boardId,
      initialNodes,
      initialEdges,
      host,
    });
  }

  return (
    <BoardStoreContext.Provider value={storeRef.current}>
      {children}
    </BoardStoreContext.Provider>
  );
}

export function useBoardStore<T>(selector: (state: BoardState) => T): T {
  const store = useContext(BoardStoreContext);
  if (!store) {
    throw new Error("useBoardStore must be used within a BoardStoreProvider");
  }
  return useStore(store, selector);
}

export function useBoardStoreApi(): BoardStore {
  const store = useContext(BoardStoreContext);
  if (!store) {
    throw new Error("Board store is not available outside of its provider");
  }
  return store;
}

export function useBoardId(): string | undefined {
  return useBoardStore((state) => state.boardId);
}
