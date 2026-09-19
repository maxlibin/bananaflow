"use client";

import { memo, useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import type { UploadAssetResult } from "../../../lib/host/types";
import { Button } from "../../ui/button";
import { Upload, X, Image as ImageIcon, Loader2, Pencil } from "lucide-react";
import NextImage from "next/image";
import { NodeBox } from "./node-box";
import { useReactFlow, Handle, Position } from "@xyflow/react";
import { useReadOnly } from "../readonly-context";
import { useBoardStore } from "../../../stores/board-store";
import { useCanvasHost } from "../../canvas-host/context";
import type { GenerationFeature } from "../../../lib/host/features";
import { ImageEditorModal } from "../image-editor-modal";

interface ImageNodeProps {
  id: string;
  data: {
    label: string;
    groupId?: string;
    alt?: string;
    onDelete?: (nodeId: string) => void;
    imageUrl?: string;
    fileName?: string;
    blobPath?: string;
    fileSize?: number;
    onCreateNode?: (nodeType: string) => void;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

const ACCEPTED_TYPES = {
  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
};

const ImageNode = memo(({ id, data, isConnectable, selected }: ImageNodeProps) => {
  const canvasHost = useCanvasHost();
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const { updateNodeData } = useReactFlow();
  const { isReadOnly } = useReadOnly();
  const boardId = useBoardStore((state) => state.boardId);
  const getNodeById = useBoardStore((state) => state.getNodeById);
  const createNodeWithType = useBoardStore((state) => state.createNodeWithType);

  const preview = data.imageUrl || null;
  const fileName = data.fileName || null;

  const loadImageDimensions = useCallback((src: string) => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      setImageDimensions(null);
    };
    img.src = src;
  }, []);

  useEffect(() => {
    if (preview) {
      loadImageDimensions(preview);
    }
  }, [preview, loadImageDimensions]);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setIsUploading(true);
      try {
        if (!boardId) {
          throw new Error("Board context unavailable. Please refresh the page.");
        }

        const previousBlobPath = data.blobPath;
        const previousSize = data.fileSize ?? 0;

        const params = new URLSearchParams();
        params.set("filename", file.name);
        params.set("boardId", boardId);
        if (previousBlobPath) {
          params.set("previousBlobPath", previousBlobPath);
        }
        if (previousSize) {
          params.set("previousSize", String(previousSize));
        }

        const response = await fetch(`/api/upload-image?${params.toString()}`, {
          method: "POST",
          body: file,
        });

        const parseJson = async () => {
          try {
            return await response.json();
          } catch (error) {
            console.error("Failed to parse upload response", error);
            return null;
          }
        };

        if (!response.ok) {
          const payload = (await parseJson()) as
            | {
                error?: string;
                upgradeRequired?: boolean;
                feature?: GenerationFeature;
              }
            | null;

          if (response.status === 429 && payload?.upgradeRequired) {
            canvasHost.onLimit({
              feature: payload.feature ?? "STORAGE_BYTES",
              kind: "storage",
              severity: "warning",
              message:
                payload.error ??
                "Image upload limit reached for your current plan.",
              plan: null,
            });
          }

          const message = payload?.error || `Upload failed with status ${response.status}`;
          throw new Error(message);
        }

        const result = ((await parseJson()) || {}) as {
          success: boolean;
          blob: UploadAssetResult;
          size?: number;
          storageUsed?: number;
        };

        if (!result.success || !result.blob?.url) {
          throw new Error("Upload response did not include a blob URL");
        }

        loadImageDimensions(result.blob.url);
        updateNodeData(id, {
          imageUrl: result.blob.url,
          fileName: file.name,
          blobPath: result.blob.pathname ?? result.blob.url,
          fileSize: result.size ?? file.size,
        });
      } catch (error) {
        console.error("Image upload failed:", error);
        setUploadError(
          error instanceof Error ? error.message : "Upload failed unexpectedly"
        );
      } finally {
        setIsUploading(false);
      }
    },
    [boardId, canvasHost, data.blobPath, data.fileSize, id, loadImageDimensions, updateNodeData]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file || isUploading) return;
      uploadFile(file);
    },
    [uploadFile, isUploading]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: false,
    disabled: isUploading,
  });

  const clearImage = () => {
    const previousBlobPath = data.blobPath;
    const previousSize = data.fileSize ?? 0;

    if (boardId && previousBlobPath && previousSize) {
      const params = new URLSearchParams();
      params.set("boardId", boardId);
      params.set("previousBlobPath", previousBlobPath);
      params.set("previousSize", String(previousSize));

      void fetch(`/api/upload-image?${params.toString()}`, {
        method: "DELETE",
      });
    }

    setImageDimensions(null);
    updateNodeData(id, {
      imageUrl: undefined,
      fileName: undefined,
      blobPath: undefined,
      fileSize: undefined,
    });
  };

  return (
    <NodeBox
      id={id}
      title="Image"
      icon={<ImageIcon className="h-4 w-4" />}
      isConnectable={isConnectable}
      onDelete={data.onDelete}
      minWidth="280px"
      nodeType="imageNode"
      onCreateNode={data.onCreateNode}
      selected={selected}
    >
      <div
        {...(!isReadOnly ? getRootProps() : {})}
        className={`
          border-2 border-dashed rounded-md text-center transition-colors
          ${preview ? "p-0" : "p-4"}
          ${
            isReadOnly
              ? "border-transparent cursor-default opacity-75"
              : isDragActive
              ? "border-primary bg-primary/5 cursor-pointer"
              : preview
              ? "border-none cursor-pointer"
              : "border-gray-300 hover:border-gray-400 cursor-pointer"
          }
          ${isUploading ? "opacity-60 pointer-events-none" : ""}
        `}
      >
        <input {...getInputProps()} />

        {preview ? (
          <div className="space-y-2">
            <div className="relative group">
              <NextImage
                src={preview}
                alt={data.alt || data.label}
                width={280}
                height={
                  imageDimensions
                    ? Math.round(
                        (280 * imageDimensions.height) / imageDimensions.width
                      )
                    : 96
                }
                className="w-full max-w-[280px] object-contain rounded"
              />
              {!isReadOnly && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditorOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 w-8 p-0 shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearImage();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {fileName && (
              <p className="text-xs text-gray-600 truncate">{fileName}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="mx-auto w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              ) : isDragActive ? (
                <Upload className="h-4 w-4 text-primary" />
              ) : (
                <ImageIcon className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900">
                {isUploading
                  ? "Uploading..."
                  : isDragActive
                  ? "Drop image here"
                  : "Drop image or click"}
              </p>
            </div>
            {uploadError && (
              <p className="text-[10px] text-destructive">{uploadError}</p>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />

      {preview && editorOpen && (
        <ImageEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          imageUrl={preview}
          fileName={fileName ?? undefined}
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
                alt: data.alt ?? "Edited image",
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
});

ImageNode.displayName = "ImageNode";

export default ImageNode;
