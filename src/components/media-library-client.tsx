"use client";

import { useCanvasHost } from "./canvas-host/context";
import type { MediaItem } from "../lib/actions/media";
import { useState, useMemo } from "react";
import NextImage from "next/image";
import { Button } from "./ui/button";
import { MediaLightbox } from "./ui/media-lightbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import {
  Image as ImageIcon,
  Video,
  Search,
  Download,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useRouter } from "next/navigation";
import { confirmDialog, notifyDialog } from "./ui/dialog-host";

interface MediaLibraryClientProps {
  initialMedia: MediaItem[];
}

type FilterType = "all" | "IMAGE" | "VIDEO";
type SortType = "newest" | "oldest";

export function MediaLibraryClient({ initialMedia }: MediaLibraryClientProps) {
  const { actions } = useCanvasHost();
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const filteredMedia = useMemo(() => {
    let result = [...media];

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((m) => m.type === filterType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.fileName?.toLowerCase().includes(query) ||
          m.prompt?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortType === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [media, filterType, sortType, searchQuery]);

  const imageCount = media.filter((m) => m.type === "IMAGE").length;
  const videoCount = media.filter((m) => m.type === "VIDEO").length;

  const handleMediaClick = (item: MediaItem) => {
    setSelectedMedia(item);
    setLightboxOpen(true);
  };

  const handleDelete = async (mediaId: string) => {
    const ok = await confirmDialog({
      title: "Delete media?",
      description: "Are you sure you want to delete this media?",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setIsDeleting(mediaId);
    const result = await actions.deleteMedia(mediaId);
    setIsDeleting(null);

    if (result.success) {
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
    } else {
      notifyDialog({
        title: "Delete failed",
        description: "Failed to delete media. Please try again.",
      });
    }
  };

  const handleDownload = async (item: MediaItem) => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.fileName || `media-${item.id}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      notifyDialog({
        title: "Download failed",
        description: "Failed to download media.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" />
            {imageCount} image{imageCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <Video className="h-4 w-4" />
            {videoCount} video{videoCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by prompt or filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={filterType}
            onValueChange={(v) => setFilterType(v as FilterType)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="IMAGE">Images</SelectItem>
              <SelectItem value="VIDEO">Videos</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortType}
            onValueChange={(v) => setSortType(v as SortType)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Media Grid */}
      {filteredMedia.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-2">No media found</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            {media.length === 0
              ? "Start creating images and videos on your boards. They will appear here."
              : "Try adjusting your filters or search query."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredMedia.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group relative aspect-square rounded-xl overflow-hidden",
                "bg-muted/50 border border-border/50",
                "hover:border-primary/50 hover:ring-2 hover:ring-primary/20",
                "transition-all duration-200"
              )}
            >
              <button
                onClick={() => handleMediaClick(item)}
                className="w-full h-full"
              >
                {item.type === "IMAGE" ? (
                  <NextImage
                    src={item.url}
                    alt={item.fileName || "Media"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <Video className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </button>

              {/* Type badge */}
              <div
                className={cn(
                  "absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium",
                  "bg-black/60 backdrop-blur-sm text-white"
                )}
              >
                {item.type === "VIDEO" ? (
                  <Video className="h-3 w-3" />
                ) : (
                  <ImageIcon className="h-3 w-3" />
                )}
              </div>

              {/* Hover overlay with actions */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white text-xs truncate mb-2">
                    {item.prompt || item.fileName || "Untitled"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2 flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item);
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      <span className="text-xs">Save</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      disabled={isDeleting === item.id}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedMedia && (
        <MediaLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          media={{
            type: selectedMedia.type === "IMAGE" ? "image" : "video",
            url: selectedMedia.url,
            fileName: selectedMedia.fileName || undefined,
          }}
        />
      )}
    </div>
  );
}
