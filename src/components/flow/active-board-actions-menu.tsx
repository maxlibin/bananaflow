"use client";

import { useCanvasHost } from "../canvas-host/context";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { BoardDetailsDialog } from "../dashboard/board-details-dialog";
import { confirmDialog, notifyDialog } from "../ui/dialog-host";
import { useBoardTabsStore } from "../../stores/board-tabs-store";

interface ActiveBoardActionsMenuProps {
  boardId: string;
}

export function ActiveBoardActionsMenu({ boardId }: ActiveBoardActionsMenuProps) {
  const { actions } = useCanvasHost();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [initialTitle, setInitialTitle] = useState("");
  const [initialDescription, setInitialDescription] = useState<string | null>(
    "",
  );
  const updateTabTitle = useBoardTabsStore((s) => s.updateTabTitle);

  const openEditDialog = async () => {
    const result = await actions.getBoard(boardId);
    if (!result.success || !result.board) {
      notifyDialog({
        title: "Couldn't load board",
        description: result.error ?? "Please try again.",
      });
      return;
    }
    setInitialTitle(result.board.title);
    setInitialDescription(result.board.description ?? "");
    setEditOpen(true);
  };

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: "Delete board?",
      description:
        "Are you sure you want to delete this board? This action cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;

    const result = await actions.deleteBoard(boardId);
    if (!result.success) {
      notifyDialog({
        title: "Delete failed",
        description: "Failed to delete board. Please try again.",
      });
      return;
    }

    window.dispatchEvent(
      new CustomEvent("banana-flow:board-deleted", {
        detail: { boardId },
      }),
    );
    router.push("/dashboard");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            aria-label="Board actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={openEditDialog}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BoardDetailsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialTitle={initialTitle}
        initialDescription={initialDescription}
        onSubmit={async ({ title, description }) => {
          const result = await actions.updateBoard(boardId, {
            title,
            description: description ?? undefined,
          });
          if (!result.success) {
            return { ok: false, error: result.error };
          }
          updateTabTitle(boardId, title);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
