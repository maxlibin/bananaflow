"use client";

import { useState, useMemo } from "react";
import NextImage from "next/image";
import { useBoardStore } from "../../stores/board-store";
import { useMediaPanel } from "./media-panel-context";
import { Button } from "../ui/button";
import { MediaLightbox } from "../ui/media-lightbox";
import {
  PanelRightClose,
  PanelRightOpen,
  Image as ImageIcon,
  Video,
  FolderOpen,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface MediaItem {
  type: "image" | "video";
  url: string;
  fileName?: string;
  nodeId: string;
  source: "uploaded" | "generated";
}

export function MediaPanel() {
  const { isOpen, setOpen: setIsOpen } = useMediaPanel();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const nodes = useBoardStore((state) => state.nodes);

  const mediaItems = useMemo(() => {
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
  }, [nodes]);

  const imageCount = mediaItems.filter((m) => m.type === "image").length;
  const videoCount = mediaItems.filter((m) => m.type === "video").length;

  const handleMediaClick = (item: MediaItem) => {
    setSelectedMedia(item);
    setLightboxOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          "absolute top-0 right-0 h-full z-10 transition-transform duration-300 ease-in-out w-72",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Toggle button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-20 h-8 w-8 bg-background/95 backdrop-blur-md border border-r-0 shadow-sm hover:bg-background rounded-l-md rounded-r-none",
            "-left-8",
          )}
        >
          {isOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>

        {/* Panel content */}
        <div
          className={cn(
            "h-full bg-background border-l overflow-hidden",
            "opacity-100",
          )}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Media Library
              </h3>
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {imageCount} image{imageCount !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Video className="h-3 w-3" />
                  {videoCount} video{videoCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Media grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {mediaItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
                  <FolderOpen className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-xs">No media yet</p>
                  <p className="text-xs opacity-70">
                    Upload or generate images to see them here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {mediaItems.map((item, index) => (
                    <button
                      key={`${item.nodeId}-${index}`}
                      onClick={() => handleMediaClick(item)}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden",
                        "bg-muted/50 border border-border/50",
                        "hover:border-primary/50 hover:ring-2 hover:ring-primary/20",
                        "transition-all duration-200 cursor-pointer group",
                      )}
                    >
                      {item.type === "image" ? (
                        <NextImage
                          src={item.url}
                          alt={item.fileName || "Media"}
                          fill
                          className="object-cover"
                          sizes="128px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <Video className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}

                      {/* Overlay with type badge */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Type indicator */}
                      <div
                        className={cn(
                          "absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                          item.source === "generated"
                            ? "bg-purple-500/90 text-white"
                            : "bg-blue-500/90 text-white",
                        )}
                      >
                        {item.type === "video" ? (
                          <Video className="h-2.5 w-2.5" />
                        ) : (
                          <ImageIcon className="h-2.5 w-2.5" />
                        )}
                      </div>

                      {/* File name on hover */}
                      <div className="absolute bottom-0 left-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate">
                          {item.fileName}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <MediaLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        media={selectedMedia}
      />
    </>
  );
}
