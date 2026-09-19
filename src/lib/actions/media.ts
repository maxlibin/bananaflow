import { and, desc, eq, inArray } from "drizzle-orm";
import { boardNodes, boards, media as mediaTable } from "../../db/schema";
import type { HostAdapter } from "../host/types";

import { revalidatePath } from "next/cache";

type MediaType = "IMAGE" | "VIDEO";

export interface MediaItem {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  blobPath: string | null;
  fileName: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  prompt: string | null;
  boardId: string | null;
  nodeId: string | null;
  createdAt: Date;
}

export interface MediaListResult {
  success: boolean;
  media?: MediaItem[];
  total?: number;
  error?: string;
}

// Interface for board node data that contains generated images
interface NodeDataWithImages {
  imageUrl?: string;
  images?: Array<{ nodeId: string; imageUrl: string; fileName?: string }>;
  prompt?: string;
  // Generated image result from outputNode
  result?: {
    imageUrl?: string;
    prompt?: string;
    status?: string;
    fileName?: string;
    fileSize?: number;
  };
  videoUrl?: string;
}

export type MediaListOptions = {
  type?: MediaType;
  limit?: number;
  offset?: number;
};

export async function getAllMedia(
  host: HostAdapter,
  options?: MediaListOptions,
): Promise<MediaListResult> {
  try {
    const userId = await host.auth.getUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const boardsWithNodes = await host.db.query.boards.findMany({
      where: eq(boards.userId, userId),
      orderBy: [desc(boards.updatedAt)],
      with: {
        nodes: {
          where: inArray(boardNodes.type, [
            "outputNode",
            "imageNode",
            "videoNode",
          ]),
        },
      },
    });

    const mediaItems: MediaItem[] = [];

    for (const board of boardsWithNodes) {
      for (const node of board.nodes) {
        const data = node.data as NodeDataWithImages;

        // Handle outputNode with generated result
        if (node.type === "outputNode" && data.result?.imageUrl) {
          if (!options?.type || options.type === "IMAGE") {
            mediaItems.push({
              id: `${node.id}-generated`,
              type: "IMAGE",
              url: data.result.imageUrl,
              blobPath: null,
              fileName: data.result.fileName || null,
              fileSize: data.result.fileSize || null,
              width: null,
              height: null,
              prompt: data.result.prompt || data.prompt || null,
              boardId: board.id,
              nodeId: node.id,
              createdAt: node.updatedAt,
            });
          }
        }

        // Handle outputNode with multiple images
        if (node.type === "outputNode" && data.images && data.images.length > 0) {
          for (let i = 0; i < data.images.length; i++) {
            const img = data.images[i];
            if (!options?.type || options.type === "IMAGE") {
              mediaItems.push({
                id: `${node.id}-img-${i}`,
                type: "IMAGE",
                url: img.imageUrl,
                blobPath: null,
                fileName: img.fileName || null,
                fileSize: null,
                width: null,
                height: null,
                prompt: data.prompt || null,
                boardId: board.id,
                nodeId: node.id,
                createdAt: node.updatedAt,
              });
            }
          }
        }

        // Handle imageNode with single imageUrl
        if (node.type === "imageNode" && data.imageUrl) {
          if (!options?.type || options.type === "IMAGE") {
            mediaItems.push({
              id: `${node.id}-image`,
              type: "IMAGE",
              url: data.imageUrl,
              blobPath: null,
              fileName: null,
              fileSize: null,
              width: null,
              height: null,
              prompt: null,
              boardId: board.id,
              nodeId: node.id,
              createdAt: node.updatedAt,
            });
          }
        }

        // Handle videoNode
        if (node.type === "videoNode" && data.videoUrl) {
          if (!options?.type || options.type === "VIDEO") {
            mediaItems.push({
              id: `${node.id}-video`,
              type: "VIDEO",
              url: data.videoUrl,
              blobPath: null,
              fileName: null,
              fileSize: null,
              width: null,
              height: null,
              prompt: data.prompt || null,
              boardId: board.id,
              nodeId: node.id,
              createdAt: node.updatedAt,
            });
          }
        }
      }
    }

    // Sort by createdAt descending
    mediaItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const total = mediaItems.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    const paginatedItems = mediaItems.slice(offset, offset + limit);

    return {
      success: true,
      media: paginatedItems,
      total,
    };
  } catch (error) {
    console.error("Failed to fetch media:", error);
    return { success: false, error: "Failed to fetch media" };
  }
}

export async function createMedia(
  host: HostAdapter,
  data: {
  type: MediaType;
  url: string;
  blobPath?: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  prompt?: string;
  boardId?: string;
  nodeId?: string;
}): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    const userId = await host.auth.getUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const [created] = await host.db
      .insert(mediaTable)
      .values({
        userId,
        type: data.type,
        url: data.url,
        blobPath: data.blobPath,
        fileName: data.fileName,
        fileSize: data.fileSize,
        width: data.width,
        height: data.height,
        prompt: data.prompt,
        boardId: data.boardId,
        nodeId: data.nodeId,
      })
      .returning({ id: mediaTable.id });

    revalidatePath("/library");
    return { success: true, mediaId: created.id };
  } catch (error) {
    console.error("Failed to create media:", error);
    return { success: false, error: "Failed to create media" };
  }
}

export async function deleteMedia(
  host: HostAdapter,
  mediaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await host.auth.getUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const existing = await host.db.query.media.findFirst({
      where: and(eq(mediaTable.id, mediaId), eq(mediaTable.userId, userId)),
    });

    if (!existing) {
      return { success: false, error: "Media not found" };
    }

    await host.db.delete(mediaTable).where(eq(mediaTable.id, mediaId));

    revalidatePath("/library");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete media:", error);
    return { success: false, error: "Failed to delete media" };
  }
}
