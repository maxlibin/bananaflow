"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "../ui/button";
import { CreateBoardDialog } from "./create-board-dialog";

export function DashboardEmptyState() {
  const router = useRouter();

  const handleBoardCreated = (boardId: string) => {
    router.push(`/board/${boardId}`);
  };

  return (
    <CreateBoardDialog
      onBoardCreated={handleBoardCreated}
      trigger={
        <button
          type="button"
          className="w-full rounded-xl border-2 border-dotted border-primary/40 bg-primary/[0.02] hover:bg-primary/[0.05] hover:border-primary/60 transition-colors px-6 py-16 sm:py-20 flex flex-col items-center text-center gap-5 cursor-pointer"
        >
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h3 className="font-semibold text-base">Create your first board</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            A board is your canvas for AI workflows. Wire prompts to image or
            video nodes, run them, and remix from there.
          </p>
          <span className={buttonVariants()} aria-hidden>
            Create board
          </span>
        </button>
      }
    />
  );
}
