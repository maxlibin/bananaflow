"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Loader2 } from "lucide-react";
import isPropValid from "@emotion/is-prop-valid";
import { StyleSheetManager } from "styled-components";
import { cn } from "../../lib/utils";
import { useCanvasHost } from "../canvas-host/context";
import type { GenerationFeature } from "../../lib/host/features";

// Inline constants to avoid importing the full module at the top level
// (react-filerobot-image-editor accesses `window` on import)
const TABS = {
  ADJUST: "Adjust" as const,
  ANNOTATE: "Annotate" as const,
  FILTERS: "Filters" as const,
  FINETUNE: "Finetune" as const,
  RESIZE: "Resize" as const,
};
const TOOLS = { CROP: "Crop" as const };
const shouldForwardProp = (propName: string, target: unknown) =>
  typeof target !== "string" || isPropValid(propName);

const FilerobotImageEditor = dynamic(
  async () => {
    const ReactModule = await import("react");
    const ReactGlobal =
      (ReactModule as unknown as { default?: unknown }).default ?? ReactModule;
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).React = ReactGlobal;
      (globalThis as unknown as Record<string, unknown>).React = ReactGlobal;
    }
    // Register custom Konva shape used internally by filerobot (FormattedTextFIE)
    // before mounting the editor to avoid unknown-node warnings.
    await import("react-filerobot-image-editor/lib/custom/shapes/FormattedText");
    return import("react-filerobot-image-editor");
  },
  { ssr: false }
);

interface SaveResult {
  url: string;
  blobPath: string;
  size: number;
  fileName: string;
}

interface ImageEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  fileName?: string;
  boardId: string;
  previousBlobPath?: string;
  previousSize?: number;
  onSave: (result: SaveResult) => void;
}

export function ImageEditorModal({
  open,
  onOpenChange,
  imageUrl,
  fileName,
  boardId,
  previousBlobPath,
  previousSize,
  onSave,
}: ImageEditorModalProps) {
  const canvasHost = useCanvasHost();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localSource, setLocalSource] = useState<string | null>(null);

  // Convert cross-origin image to a local blob URL so the canvas can access pixels
  useEffect(() => {
    if (!open || !imageUrl) {
      setLocalSource(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    const loadAsBlobUrl = async (sourceUrl: string) => {
      const response = await fetch(sourceUrl, { signal: controller.signal });
      if (!response.ok) return null;

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        return null;
      }

      return URL.createObjectURL(blob);
    };

    const resolveLocalSource = async () => {
      const candidates = [imageUrl];
      if (!imageUrl.startsWith("blob:") && !imageUrl.startsWith("data:")) {
        candidates.push(
          `/api/download-asset?url=${encodeURIComponent(imageUrl)}`,
        );
        candidates.push(`/_next/image?url=${encodeURIComponent(imageUrl)}&w=2048&q=100`);
      }

      for (const candidate of candidates) {
        try {
          const blobUrl = await loadAsBlobUrl(candidate);
          if (!blobUrl) continue;

          if (cancelled) {
            URL.revokeObjectURL(blobUrl);
            return;
          }

          setLocalSource(blobUrl);
          return;
        } catch {
          continue;
        }
      }

      if (!cancelled) setLocalSource(imageUrl);
    };

    void resolveLocalSource();

    return () => {
      cancelled = true;
      controller.abort();
      setLocalSource((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [open, imageUrl]);

  const handleSave = useCallback(
    async (savedImageData: { imageBase64?: string; name?: string }) => {
      if (!savedImageData.imageBase64) return;

      setIsSaving(true);
      setSaveError(null);

      try {
        const response = await fetch(savedImageData.imageBase64);
        const blob = await response.blob();

        const baseName = fileName
          ? fileName.replace(/\.[^.]+$/, "")
          : "image";
        const editedFileName = `${baseName}-edited.png`;

        const params = new URLSearchParams();
        params.set("filename", editedFileName);
        params.set("boardId", boardId);
        if (previousBlobPath) {
          params.set("previousBlobPath", previousBlobPath);
        }
        if (previousSize) {
          params.set("previousSize", String(previousSize));
        }

        const uploadResponse = await fetch(
          `/api/upload-image?${params.toString()}`,
          { method: "POST", body: blob }
        );

        if (!uploadResponse.ok) {
          const payload = await uploadResponse.json().catch(() => null);
          if (uploadResponse.status === 429 && payload?.upgradeRequired) {
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
            payload?.error || `Upload failed with status ${uploadResponse.status}`
          );
        }

        const result = await uploadResponse.json();
        if (!result.success || !result.blob?.url) {
          throw new Error("Upload response missing blob URL");
        }

        onSave({
          url: result.blob.url,
          blobPath: result.blob.pathname ?? result.blob.url,
          size: result.size ?? blob.size,
          fileName: editedFileName,
        });

        onOpenChange(false);
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Save failed"
        );
      } finally {
        setIsSaving(false);
      }
    },
    [boardId, canvasHost, fileName, onOpenChange, onSave, previousBlobPath, previousSize]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <div
          aria-hidden
          onClick={handleClose}
          className={cn(
            "fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm",
            "animate-in fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2",
            "w-[70vw] h-[90vh] flex flex-col bg-background border border-border rounded-lg overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>Edit Image</DialogPrimitive.Title>
          </VisuallyHidden>
          <VisuallyHidden>
            <DialogPrimitive.Description>
              Edit and save the selected image.
            </DialogPrimitive.Description>
          </VisuallyHidden>

          <div className="flex-1 min-h-0">
            {localSource ? (
              <StyleSheetManager shouldForwardProp={shouldForwardProp}>
                <FilerobotImageEditor
                  source={localSource}
                  onSave={handleSave}
                  onClose={handleClose}
                  tabsIds={[
                    TABS.ADJUST,
                    TABS.ANNOTATE,
                    TABS.FILTERS,
                    TABS.FINETUNE,
                    TABS.RESIZE,
                  ]}
                  defaultTabId={TABS.ADJUST}
                  defaultToolId={TOOLS.CROP}
                  defaultSavedImageType="png"
                  savingPixelRatio={4}
                  previewPixelRatio={typeof window !== "undefined" ? window.devicePixelRatio : 1}
                  closeAfterSave={false}
                  observePluginContainerSize
                />
              </StyleSheetManager>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {isSaving && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40">
              <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg shadow-lg">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Saving...</span>
              </div>
            </div>
          )}

          {saveError && (
            <div className="absolute bottom-4 left-4 right-4 z-[60] bg-destructive/90 text-white text-sm p-3 rounded-lg">
              {saveError}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
