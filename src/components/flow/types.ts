import { Node, Edge, ReactFlowInstance } from "@xyflow/react";

export interface ImageModelSettings {
  aspectRatio?: string;
  imageSize?: string;
  imageResolution?: string;
  quality?: string;
  style?: string;
  renderingSpeed?: string;
  outputFormat?: string;
  nVariants?: number;
}

export interface FlowContainerProps {
  // Add any props if needed in the future
  [key: string]: unknown;
}

export interface NodeCreationCallbacks {
  onDelete: (nodeId: string) => void;
  onGenerate?: (
    nodeId: string,
    connectedData?: {
      prompt?: string;
      images?: Array<{ nodeId: string; imageUrl: string; fileName: string }>;
      model?: string;
      settings?: ImageModelSettings;
    }
  ) => Promise<void>;
  onCancelGenerate?: (nodeId: string) => void;
  onSubmit?: (prompt: string, nodeId: string) => void;
}

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  prompt?: string;
  error?: string;
}

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  prompt?: string;
  error?: string;
}

export interface WorkflowGroupConfig {
  baseX: number;
  baseY: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  timestamp: number;
}
