"use client";

import { useCanvasHost } from "../canvas-host/context";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { notifyDialog } from "../ui/dialog-host";

interface CreateBoardDialogProps {
  onBoardCreated?: (boardId: string) => void;
  trigger?: React.ReactNode;
}

export function CreateBoardDialog({
  onBoardCreated,
  trigger,
}: CreateBoardDialogProps) {
  const canvasHost = useCanvasHost();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    setIsLoading(true);
    try {
      const result = await canvasHost.actions.createBoard({
        title: title.trim(),
        description: description.trim() || undefined,
        isPublic,
      });

      if (result.success && result.board) {
        // Reset form
        setTitle("");
        setDescription("");
        setIsPublic(false);
        setOpen(false);

        // Notify parent component
        onBoardCreated?.(result.board.id);
      } else if ("upgradeRequired" in result && result.upgradeRequired) {
        canvasHost.onLimit({
          feature: result.feature,
          kind: "plan",
          severity: "warning",
          message:
            result.error ??
            "Board limit reached for your current plan. Upgrade to create more boards.",
          plan: null,
        });
        notifyDialog({
          title: "Upgrade required",
          description:
            result.error ??
            "Board limit reached for your current plan. Head to billing to upgrade.",
        });
      } else {
        notifyDialog({
          title: "Couldn't create board",
          description: result.error || "Failed to create board. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error creating board:", error);
      notifyDialog({
        title: "Couldn't create board",
        description: "Failed to create board. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-auto p-6 flex-col gap-2 min-h-[120px] border-dashed border-2 hover:border-primary/50 transition-colors bg-background text-primary hover:bg-primary/5 cursor-pointer">
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">Create New Board</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
            <DialogDescription>
              Create a new flow board. Each board contains its own set of nodes
              and connections.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                placeholder="My Awesome Flow"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (optional)
              </label>
              <Textarea
                id="description"
                placeholder="Describe what this flow is for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="isPublic"
                type="checkbox"
                className="rounded border-gray-300"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={isLoading}
              />
              <label htmlFor="isPublic" className="text-sm font-medium">
                Make this board public
              </label>
            </div>
            <div className="text-xs text-muted-foreground">
              {isPublic
                ? "Anyone with the link will be able to view this board"
                : "Only you will be able to view this board"}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isLoading}>
              {isLoading ? "Creating..." : "Create Board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
