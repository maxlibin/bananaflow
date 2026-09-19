"use client";

import { useCanvasHost } from "../canvas-host/context";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { BoardCard } from "./board-card";
import { CreateBoardDialog } from "./create-board-dialog";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Board } from "../../types/board";
import { confirmDialog, notifyDialog } from "../ui/dialog-host";

interface DashboardClientProps {
  initialBoards: Board[];
}

type Visibility = "all" | "public" | "private";
type SortKey = "createdDesc" | "createdAsc" | "updatedDesc" | "titleAsc";

const SORT_LABEL: Record<SortKey, string> = {
  createdDesc: "Newest",
  createdAsc: "Oldest",
  updatedDesc: "Recently updated",
  titleAsc: "Title (A–Z)",
};

export function DashboardClient({ initialBoards }: DashboardClientProps) {
  const { actions } = useCanvasHost();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [sort, setSort] = useState<SortKey>("createdDesc");

  const handleBoardCreated = (boardId: string) => {
    router.push(`/board/${boardId}`);
  };

  const handleDeleteBoard = async (boardId: string) => {
    const ok = await confirmDialog({
      title: "Delete board?",
      description:
        "Are you sure you want to delete this board? This action cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;

    const result = await actions.deleteBoard(boardId);
    if (result.success) {
      window.dispatchEvent(
        new CustomEvent("banana-flow:board-deleted", { detail: { boardId } }),
      );
      router.refresh();
    } else {
      notifyDialog({
        title: "Delete failed",
        description: "Failed to delete board. Please try again.",
      });
    }
  };

  const filteredBoards = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const matches = (board: Board) => {
      if (visibility === "public" && !board.isPublic) return false;
      if (visibility === "private" && board.isPublic) return false;
      if (!trimmed) return true;
      return (
        board.title.toLowerCase().includes(trimmed) ||
        (board.description?.toLowerCase().includes(trimmed) ?? false)
      );
    };

    const sorted = initialBoards.filter(matches).slice();
    sorted.sort((a, b) => {
      switch (sort) {
        case "createdAsc":
          return a.createdAt.getTime() - b.createdAt.getTime();
        case "updatedDesc":
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case "titleAsc":
          return a.title.localeCompare(b.title);
        case "createdDesc":
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
    return sorted;
  }, [initialBoards, query, visibility, sort]);

  const hasFilters = query.trim() !== "" || visibility !== "all";
  const isEmpty = initialBoards.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <CreateBoardDialog onBoardCreated={handleBoardCreated} />
        <p className="text-muted-foreground text-sm mt-4 text-center">
          No boards yet. Create your first board, or start from a template
          below.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or description"
            className="pl-9"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Select
          value={visibility}
          onValueChange={(v) => setVisibility(v as Visibility)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All boards</SelectItem>
            <SelectItem value="public">Public only</SelectItem>
            <SelectItem value="private">Private only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {SORT_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CreateBoardDialog onBoardCreated={handleBoardCreated} />

        {filteredBoards.map((board, index) => (
          <BoardCard
            key={board.id}
            board={board}
            onDelete={handleDeleteBoard}
            priority={index < 4}
          />
        ))}
      </div>

      {filteredBoards.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg mb-2">
            {hasFilters
              ? "No boards match your filters."
              : "No boards yet. Create your first board to get started!"}
          </p>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setVisibility("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </>
  );
}
