"use client";

import { useCanvasHost } from "../canvas-host/context";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import NextImage from "next/image";
import { Board } from "../../types/board";
import { Button } from "../ui/button";
import {
  MoreVertical,
  ExternalLink,
  Pencil,
  Trash2,
  Globe,
  Lock,
  Eye,
  Workflow,
  ArrowRight,
  HardDrive,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";
import { BoardDetailsDialog } from "./board-details-dialog";
import { useRouter } from "next/navigation";

interface BoardCardProps {
  board: Board;
  onDelete: (boardId: string) => void;
  priority?: boolean;
}

export function BoardCard({ board, onDelete, priority }: BoardCardProps) {
  const { actions } = useCanvasHost();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const formatDate = (date: Date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const formatBytes = (bytes?: number) => {
    const value = typeof bytes === "number" && bytes > 0 ? bytes : 0;
    if (value === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
      Math.floor(Math.log(value) / Math.log(1024)),
      units.length - 1,
    );
    const scaled = value / Math.pow(1024, index);
    return `${scaled.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const nodeCount = board.nodeCount ?? 0;
  const edgeCount = board.edgeCount ?? 0;

  return (
    <div className="contents">
    <Link href={`/board/${board.id}`} className="group block h-full">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-muted h-full min-h-[380px]",
          "transition-all duration-300",
          "hover:scale-[1.02] hover:shadow-lg",
        )}
      >
        {/* Full-card background image */}
        {board.thumbnailUrl ? (
          <NextImage
            src={board.thumbnailUrl}
            alt={board.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Workflow className="h-20 w-20 text-foreground/10" />
          </div>
        )}

        {/* Dark overlay on image */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />

        {/* Top row: badge + menu */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between">
          {board.isPublic ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500 text-white shadow-sm">
              <Globe className="h-3 w-3" />
              Public
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-orange-500 text-white shadow-sm">
              <Lock className="h-3 w-3" />
              Private
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-full bg-orange-500 text-white shadow-sm",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  "hover:bg-orange-600",
                )}
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/board/${board.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Board
                </Link>
              </DropdownMenuItem>
              {board.isPublic && (
                <DropdownMenuItem asChild>
                  <Link href={`/remix/${board.id}`} target="_blank">
                    <Eye className="mr-2 h-4 w-4" />
                    View Public
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  setEditOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(board.id);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Bottom gradient overlay + content */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-base text-white truncate">
              {board.title}
            </h3>
            {nodeCount > 0 && (
              <span className="text-[11px] text-white/70 whitespace-nowrap ml-2">
                {nodeCount} nodes
              </span>
            )}
          </div>

          {board.description && (
            <p className="text-sm text-white/70 line-clamp-1 mb-1">
              {board.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-white/60">
            <span suppressHydrationWarning>
              Last updated: {formatDate(board.updatedAt)}
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <HardDrive className="h-3 w-3" />
              {formatBytes(board.storageUsed)}
            </span>
          </div>
        </div>
      </div>
    </Link>
    <BoardDetailsDialog
      open={editOpen}
      onOpenChange={setEditOpen}
      mode="edit"
      initialTitle={board.title}
      initialDescription={board.description}
      onSubmit={async ({ title, description }) => {
        const result = await actions.updateBoard(board.id, {
          title,
          description: description ?? undefined,
        });
        if (!result.success) {
          return { ok: false, error: result.error };
        }
        router.refresh();
        return { ok: true };
      }}
    />
    </div>
  );
}
