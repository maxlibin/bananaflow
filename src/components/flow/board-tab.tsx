"use client";

import { useCanvasHost } from "../canvas-host/context";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "../../lib/utils";
import { useBoardTabsStore, type BoardTab } from "../../stores/board-tabs-store";

interface BoardTabProps {
  tab: BoardTab;
  isActive: boolean;
  activeBoardId: string | null;
}

export function BoardTabItem({ tab, isActive, activeBoardId }: BoardTabProps) {
  const { track } = useCanvasHost();
  const router = useRouter();
  const closeTab = useBoardTabsStore((s) => s.closeTab);

  const onClick = () => {
    if (isActive) return;
    track("tab_opened", { source: "navigation" });
    router.push(`/board/${tab.id}`);
  };

  const onClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    track("tab_closed");
    const next = closeTab(tab.id, activeBoardId);
    if (!isActive) return;
    if (next) router.push(`/board/${next}`);
    else router.push("/dashboard");
  };

  const showCloseOverlay = isActive;

  return (
    <div
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        "group relative flex items-center px-2 py-1 h-8 max-w-[160px] overflow-hidden rounded-md text-xs cursor-pointer select-none",
        "border border-transparent",
        isActive
          ? "bg-background border-border text-foreground"
          : "text-muted-foreground hover:bg-background hover:border-border hover:text-foreground",
      )}
    >
      <span className="block whitespace-nowrap pr-1">{tab.title}</span>
      {/* Right-side fade gradient — fades the title into the close button.
          Matches the tab's hovered/active background color. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10",
          "bg-gradient-to-l from-background via-background to-transparent",
          showCloseOverlay
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100",
        )}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close ${tab.title}`}
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted",
          showCloseOverlay
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100",
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
