import type { Node } from "@xyflow/react";

export interface MediaItem {
  type: "image" | "video";
  url: string;
  fileName?: string;
  nodeId: string;
  source: "uploaded" | "generated";
}

// Every uploaded or generated image/video currently shown on the board.
export function collectBoardMedia(nodes: Node[]): MediaItem[] {
  const items: MediaItem[] = [];

  for (const node of nodes) {
    const data = node.data as Record<string, unknown> | undefined;
    if (!data) continue;

    if (node.type === "imageNode") {
      const imageUrl = data.imageUrl as string | undefined;
      if (imageUrl) {
        items.push({
          type: "image",
          url: imageUrl,
          fileName: (data.fileName as string) || "Uploaded image",
          nodeId: node.id,
          source: "uploaded",
        });
      }
    }

    if (node.type === "outputNode") {
      const result = data.result as Record<string, unknown> | undefined;
      const imageUrl = result?.imageUrl as string | undefined;
      if (imageUrl) {
        items.push({
          type: "image",
          url: imageUrl,
          fileName: (result?.fileName as string) || "Generated image",
          nodeId: node.id,
          source: "generated",
        });
      }
    }

    if (node.type === "videoNode") {
      const result = data.result as Record<string, unknown> | undefined;
      const videoUrl = result?.videoUrl as string | undefined;
      if (videoUrl) {
        items.push({
          type: "video",
          url: videoUrl,
          fileName: (result?.fileName as string) || "Generated video",
          nodeId: node.id,
          source: "generated",
        });
      }
    }
  }

  return items;
}
