import { NextResponse, type NextRequest } from "next/server";
import { adjustBoardStorage } from "../board-storage";
import { denialResponse } from "../host/denial-response";
import type { HostAdapter } from "../host/types";

const sanitizeFilename = (name: string) =>
  name
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9_.-]/g, "_");

export function createUploadImageRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    try {
      const userId = await host.auth.getUserId();

      if (!userId) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      const originalName = searchParams.get("filename");
      const boardId = searchParams.get("boardId");
      const previousBlobPath = searchParams.get("previousBlobPath") || undefined;
      const previousSizeParam = searchParams.get("previousSize");
      const previousSize = previousSizeParam
        ? Number.parseInt(previousSizeParam, 10)
        : 0;

      if (!originalName) {
        return NextResponse.json(
          { success: false, error: "Filename query parameter is required" },
          { status: 400 }
        );
      }

      const contentType =
        request.headers.get("content-type") ?? "application/octet-stream";

      if (!boardId) {
        return NextResponse.json(
          { success: false, error: "boardId query parameter is required" },
          { status: 400 }
        );
      }

      const arrayBuffer = await request.arrayBuffer();

      if (!arrayBuffer.byteLength) {
        return NextResponse.json(
          { success: false, error: "Uploaded file is empty" },
          { status: 400 }
        );
      }

      const uploadSizeBytes = arrayBuffer.byteLength;
      const deltaBytes =
        uploadSizeBytes - (Number.isFinite(previousSize) ? previousSize : 0);

      const storeDecision = await host.limits.canStore(userId, deltaBytes);
      if (!storeDecision.ok) {
        return denialResponse(storeDecision);
      }

      const safeName = sanitizeFilename(originalName);
      const blobKey = `${userId}/${Date.now()}-${safeName}`;

      const blob = await host.storage.uploadAsset({
        key: blobKey,
        body: Buffer.from(arrayBuffer),
        contentType,
      });

      let storageUsed: number | undefined;

      if (deltaBytes !== 0) {
        await host.limits.onStorageChanged({
          userId,
          boardId,
          deltaBytes,
          source: "direct_upload",
          blobPath: blob.pathname,
          previousBlobPath: previousBlobPath ?? null,
          contentType,
        });

        try {
          storageUsed = await adjustBoardStorage(host.db, userId, boardId, deltaBytes);
        } catch (error) {
          console.error("Failed to adjust board storage", error);
        }
      } else {
        try {
          storageUsed = await adjustBoardStorage(host.db, userId, boardId, 0);
        } catch (error) {
          console.error("Failed to read board storage", error);
        }
      }

      return NextResponse.json({
        success: true,
        blob,
        size: uploadSizeBytes,
        storageUsed,
      });
    } catch (error) {
      console.error("Image upload failed:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error during upload",
        },
        { status: 500 }
      );
    }
  }

  async function DELETE(request: NextRequest) {
    try {
      const userId = await host.auth.getUserId();

      if (!userId) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      const boardId = searchParams.get("boardId");
      const previousBlobPath = searchParams.get("previousBlobPath") || undefined;
      const previousSizeParam = searchParams.get("previousSize");
      const previousSize = previousSizeParam
        ? Number.parseInt(previousSizeParam, 10)
        : 0;

      if (!boardId) {
        return NextResponse.json(
          { success: false, error: "boardId query parameter is required" },
          { status: 400 }
        );
      }

      if (!previousBlobPath || !previousSize) {
        return NextResponse.json({ success: true });
      }

      await host.limits.onStorageChanged({
        userId,
        boardId,
        deltaBytes: -previousSize,
        source: "direct_upload_clear",
        blobPath: previousBlobPath,
        previousBlobPath: null,
        contentType: null,
      });

      try {
        await adjustBoardStorage(host.db, userId, boardId, -previousSize);
      } catch (error) {
        console.error("Failed to decrease board storage", error);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Image upload cleanup failed:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error during cleanup",
        },
        { status: 500 }
      );
    }
  }

  return { POST, DELETE };
}
