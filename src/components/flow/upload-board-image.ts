import type { CanvasHost } from "../canvas-host/context";
import type { GenerationFeature } from "../../lib/host/features";
import type { UploadAssetResult } from "../../lib/host/types";

export type BoardImage = {
  imageUrl: string;
  blobPath?: string;
  fileName?: string;
  fileSize?: number;
};

// Uploads a user file to the board's storage. Storage-limit denials are
// reported through the host's limit UI before the error is thrown.
export async function uploadBoardImage(input: {
  file: File;
  boardId: string | undefined;
  onLimit: CanvasHost["onLimit"];
}): Promise<BoardImage> {
  const { file, boardId } = input;
  if (!boardId) {
    throw new Error("Board context unavailable. Please refresh the page.");
  }

  const params = new URLSearchParams();
  params.set("filename", file.name);
  params.set("boardId", boardId);

  const response = await fetch(`/api/upload-image?${params.toString()}`, {
    method: "POST",
    body: file,
  });

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
      input.onLimit({
        feature: payload.feature ?? "STORAGE_BYTES",
        kind: "storage",
        severity: "warning",
        message: payload.error ?? "Image upload limit reached for your current plan.",
        plan: null,
      });
    }
    throw new Error(payload?.error || `Upload failed with status ${response.status}`);
  }

  const result = ((await parseJson()) || {}) as {
    success: boolean;
    blob: UploadAssetResult;
    size?: number;
  };

  if (!result.success || !result.blob?.url) {
    throw new Error("Upload response did not include a blob URL");
  }

  return {
    imageUrl: result.blob.url,
    blobPath: result.blob.pathname ?? result.blob.url,
    fileName: file.name,
    fileSize: result.size ?? file.size,
  };
}
