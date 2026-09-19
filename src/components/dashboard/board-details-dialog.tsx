"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

export interface BoardDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialTitle?: string;
  initialDescription?: string | null;
  // Returns { ok: true } on success or { ok: false, error } on failure.
  onSubmit: (values: { title: string; description: string | null }) => Promise<
    { ok: true } | { ok: false; error?: string }
  >;
}

export function BoardDetailsDialog({
  open,
  onOpenChange,
  mode,
  initialTitle = "",
  initialDescription = "",
  onSubmit,
}: BoardDetailsDialogProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset form whenever the dialog reopens with different initial values.
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription(initialDescription ?? "");
      setError(null);
    }
  }, [open, initialTitle, initialDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onSubmit({
        title: trimmed,
        description: description.trim() || null,
      });
      if (result.ok) {
        onOpenChange(false);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  };

  const isCreate = mode === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isCreate ? "Create new board" : "Edit board"}</DialogTitle>
            <DialogDescription>
              {isCreate
                ? "Give your board a name and an optional description."
                : "Update the board name or description."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="board-name">Name</Label>
              <Input
                id="board-name"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My new board"
                maxLength={100}
                disabled={pending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="board-description">Description</Label>
              <Textarea
                id="board-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this board for? (optional)"
                rows={3}
                maxLength={500}
                disabled={pending}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? (isCreate ? "Creating…" : "Saving…") : isCreate ? "Create board" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
