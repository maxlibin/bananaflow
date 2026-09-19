"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { useBoardTabsStore } from "../../stores/board-tabs-store";
import { BoardTabItem } from "./board-tab";
import { BoardTabPicker } from "./board-tab-picker";
import { ActiveBoardActionsMenu } from "./active-board-actions-menu";

export function BoardTabs() {
  const { boardId } = useParams<{ boardId: string }>();
  const activeBoardId = boardId ?? null;
  const tabs = useBoardTabsStore((s) => s.tabs);
  const hydrated = useBoardTabsStore((s) => s.hydrated);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setFadeLeft(el.scrollLeft > 4);
      setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [tabs.length, hydrated]);

  if (!hydrated) return null;

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <div className="relative min-w-0 flex-1">
        {fadeLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-sidebar to-transparent" />
        )}
        <div
          ref={scrollRef}
          className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"
        >
          {tabs.map((tab, i) => (
            <Fragment key={tab.id}>
              {i > 0 && (
                <span
                  className="h-4 w-px shrink-0 bg-border"
                  aria-hidden="true"
                />
              )}
              <BoardTabItem
                tab={tab}
                isActive={tab.id === activeBoardId}
                activeBoardId={activeBoardId}
              />
            </Fragment>
          ))}
          <BoardTabPicker activeBoardId={activeBoardId} />
        </div>
        {fadeRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-sidebar to-transparent" />
        )}
      </div>
      {activeBoardId && (
        <div className="ml-auto shrink-0">
          <ActiveBoardActionsMenu boardId={activeBoardId} />
        </div>
      )}
    </div>
  );
}
