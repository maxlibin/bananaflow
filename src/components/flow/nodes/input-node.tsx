"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { UploadAssetResult } from "../../../lib/host/types";
import { MessageSquare, Pencil, Plus, X, Loader2 } from "lucide-react";
import NextImage from "next/image";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { NodeBox } from "./node-box";
import { ImageEditorModal } from "../image-editor-modal";
import { useReactFlow, Handle, Position } from "@xyflow/react";
import { useReadOnly } from "../readonly-context";
import { useBoardStore } from "../../../stores/board-store";
import { useCanvasHost } from "../../canvas-host/context";
import type { GenerationFeature } from "../../../lib/host/features";

type InputImage = {
  imageUrl: string;
  blobPath?: string;
  fileName?: string;
  fileSize?: number;
};

interface InputNodeProps {
  id: string;
  data: {
    label?: string;
    value?: string;
    images?: InputImage[];
    onDelete?: (nodeId: string) => void;
    onCreateNode?: (nodeType: string) => void;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

const ACCEPTED_TYPES = {
  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
};

const InputNode = memo(
  ({ id, data, isConnectable, selected }: InputNodeProps) => {
    const canvasHost = useCanvasHost();
    const [promptText, setPromptText] = useState(data.value ?? "");
    const [images, setImages] = useState<InputImage[]>(data.images ?? []);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const { updateNodeData } = useReactFlow();
    const { isReadOnly } = useReadOnly();
    const boardId = useBoardStore((state) => state.boardId);
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

    useEffect(() => {
      adjustTextareaHeight();
    }, [promptText, adjustTextareaHeight]);

    const handleTextChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = event.target.value;
        setPromptText(newValue);
        adjustTextareaHeight();
        updateNodeData(id, { value: newValue });
      },
      [id, updateNodeData, adjustTextareaHeight],
    );

    const persistImages = useCallback(
      (next: InputImage[]) => {
        setImages(next);
        updateNodeData(id, { images: next });
      },
      [id, updateNodeData],
    );

    const uploadFile = useCallback(
      async (file: File) => {
        setUploadError(null);
        setIsUploading(true);
        try {
          if (!boardId) {
            throw new Error(
              "Board context unavailable. Please refresh the page.",
            );
          }

          const params = new URLSearchParams();
          params.set("filename", file.name);
          params.set("boardId", boardId);

          const response = await fetch(
            `/api/upload-image?${params.toString()}`,
            { method: "POST", body: file },
          );

          const parseJson = async () => {
            try {
              return await response.json();
            } catch {
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
            throw new Error(
              payload?.error || `Upload failed with status ${response.status}`,
            );
          }

          const result = ((await parseJson()) || {}) as {
            success: boolean;
            blob: UploadAssetResult;
            size?: number;
          };

          if (!result.success || !result.blob?.url) {
            throw new Error("Upload response did not include a blob URL");
          }

          persistImages([
            ...images,
            {
              imageUrl: result.blob.url,
              blobPath: result.blob.pathname ?? result.blob.url,
              fileName: file.name,
              fileSize: result.size ?? file.size,
            },
          ]);
        } catch (error) {
          console.error("Image upload failed:", error);
          setUploadError(
            error instanceof Error
              ? error.message
              : "Upload failed unexpectedly",
          );
        } finally {
          setIsUploading(false);
        }
      },
      [boardId, canvasHost, images, persistImages],
    );

    const onDrop = useCallback(
      (acceptedFiles: File[]) => {
        if (isUploading) return;
        for (const file of acceptedFiles) {
          void uploadFile(file);
        }
      },
      [uploadFile, isUploading],
    );

    const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
      onDrop,
      accept: ACCEPTED_TYPES,
      noClick: true,
      noKeyboard: true,
      disabled: isReadOnly,
      multiple: true,
    });

    const removeImage = useCallback(
      (index: number) => {
        const next = images.filter((_, i) => i !== index);
        persistImages(next);
      },
      [images, persistImages],
    );

    return (
      <NodeBox
        id={id}
        title="Input"
        icon={<MessageSquare className="h-4 w-4" />}
        isConnectable={isConnectable}
        onDelete={data.onDelete}
        minWidth="320px"
        nodeType="inputNode"
        onCreateNode={data.onCreateNode}
        selected={selected}
      >
        <div className="space-y-3">
          {/* Prompt section */}
          <div>
            <Textarea
              ref={textareaRef}
              placeholder="Describe what you want to generate..."
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

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Images section */}
          <div
            {...getRootProps()}
            className={`rounded-md transition-colors ${
              isDragActive ? "bg-emerald-50 dark:bg-emerald-950/30" : ""
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <div
                  key={`${img.imageUrl}-${idx}`}
                  className="relative group/thumb h-[60px] w-[60px] rounded border overflow-hidden bg-muted"
                >
                  <NextImage
                    src={img.imageUrl}
                    alt={img.fileName ?? `Image ${idx + 1}`}
                    fill
                    sizes="60px"
                    className="object-cover"
                  />
                  {!isReadOnly && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingIndex(idx);
                        }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full bg-background/20 hover:bg-background/70 p-2 opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer"
                        aria-label="Edit image"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(idx);
                        }}
                        className="absolute top-0 right-0 z-10 rounded-full bg-background/20 hover:bg-background/70 p-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer"
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    open();
                  }}
                  disabled={isUploading}
                  className="h-[60px] w-[60px] p-0 flex flex-col items-center justify-center gap-0.5 border-dashed"
                  aria-label="Add image"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span className="text-[9px]">Add</span>
                    </>
                  )}
                </Button>
              )}
            </div>
            {uploadError && (
              <div className="mt-1 text-[10px] text-red-600">{uploadError}</div>
            )}
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-muted-foreground/20 hover:!bg-primary"
        />
        {editingIndex !== null && images[editingIndex] && (
          <ImageEditorModal
            open={editingIndex !== null}
            onOpenChange={(open) => {
              if (!open) setEditingIndex(null);
            }}
            imageUrl={images[editingIndex].imageUrl}
            fileName={images[editingIndex].fileName ?? "image"}
            boardId={boardId ?? ""}
            previousBlobPath={images[editingIndex].blobPath}
            previousSize={images[editingIndex].fileSize}
            onSave={({ url, blobPath, size, fileName }) => {
              const idx = editingIndex;
              if (idx === null) return;
              const next = images.map((img, i) =>
                i === idx
                  ? {
                      imageUrl: url,
                      blobPath,
                      fileName,
                      fileSize: size,
                    }
                  : img,
              );
              persistImages(next);
              setEditingIndex(null);
            }}
          />
        )}
      </NodeBox>
    );
  },
);

InputNode.displayName = "InputNode";

export default InputNode;
