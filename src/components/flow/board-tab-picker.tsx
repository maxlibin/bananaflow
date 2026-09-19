"use client";

import { useCanvasHost } from "../canvas-host/context";
import { useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "../ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  MAX_OPEN_TABS,
  type BoardTabSummary,
} from "../../lib/board-tabs-constants";
import { useBoardTabsStore } from "../../stores/board-tabs-store";
import { BoardDetailsDialog } from "../dashboard/board-details-dialog";

interface BoardTabPickerProps {
  activeBoardId: string | null;
}

export function BoardTabPicker({ activeBoardId }: BoardTabPickerProps) {
  const { actions, track } = useCanvasHost();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<BoardTabSummary[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const tabs = useBoardTabsStore((s) => s.tabs);
  const tabLimit = useBoardTabsStore((s) => s.tabLimit);
  const openTab = useBoardTabsStore((s) => s.openTab);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    actions.getBoardSummaries()
      .then((rows) => {
        if (cancelled) return;
        setSummaries(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const openIds = new Set(tabs.map((t) => t.id));
  const available = summaries.filter((s) => !openIds.has(s.id));
  const limitReached = tabs.length >= tabLimit;
  const canUpgrade = limitReached && tabLimit < MAX_OPEN_TABS;

  const handlePick = (summary: BoardTabSummary) => {
    if (limitReached) return;
    track("tab_opened", { source: "picker" });
    openTab(summary, activeBoardId);
    setOpen(false);
    router.push(`/board/${summary.id}`);
  };

  const handleCreate = () => {
    if (limitReached) return;
    // Close the picker popover and hand off to the details dialog so the user
    // can name the board (and optionally describe it) before it's created.
    setOpen(false);
    setCreateDialogOpen(true);
  };

  const goToPricing = () => {
    setOpen(false);
    router.push("/pricing");
  };

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open board"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search boards…" />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="__create_new_board__"
                onSelect={handleCreate}
                disabled={limitReached}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create new board
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            {loading ? (
              <CommandGroup heading="Your boards">
                <div className="p-2 space-y-2">
                  <div className="h-6 rounded bg-muted animate-pulse" />
                  <div className="h-6 rounded bg-muted animate-pulse" />
                  <div className="h-6 rounded bg-muted animate-pulse" />
                </div>
              </CommandGroup>
            ) : (
              <>
                <CommandEmpty>No boards found.</CommandEmpty>
                <CommandGroup heading="Your boards">
                  {available.map((b) => (
                    <CommandItem
                      key={b.id}
                      value={`${b.title} ${b.id}`}
                      onSelect={() => handlePick(b)}
                      disabled={limitReached}
                    >
                      <span className="truncate">{b.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
          {limitReached && (
            <div className="border-t p-3 space-y-2">
              {canUpgrade ? (
                <>
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-snug">
                      You&apos;ve hit the {tabLimit}-tab limit on the free plan.
                      Upgrade to open up to {MAX_OPEN_TABS} boards at once.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    onClick={goToPricing}
                  >
                    Upgrade plan
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Tab limit reached — close a tab to keep more open.
                </p>
              )}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
    <BoardDetailsDialog
      open={createDialogOpen}
      onOpenChange={setCreateDialogOpen}
      mode="create"
      onSubmit={async ({ title, description }) => {
        const result = await actions.createBoard({
          title,
          description: description ?? undefined,
        });
        if (!result.success || !result.board) {
          return { ok: false, error: result.error };
        }
        track("tab_create_new_board");
        openTab(
          { id: result.board.id, title: result.board.title },
          activeBoardId,
        );
        router.push(`/board/${result.board.id}`);
        return { ok: true };
      }}
    />
    </>
  );
}
