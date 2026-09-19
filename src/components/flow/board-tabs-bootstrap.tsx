"use client";

import { useEffect } from "react";

import { useCanvasHost } from "../canvas-host/context";
import {
  useBoardTabsStore,
  type BoardTab,
} from "../../stores/board-tabs-store";

interface BoardTabsBootstrapProps {
  initialTabs: BoardTab[];
  currentBoard: BoardTab;
  tabLimit: number;
}

export function BoardTabsBootstrap({
  initialTabs,
  currentBoard,
  tabLimit,
}: BoardTabsBootstrapProps) {
  const { actions } = useCanvasHost();
  const hydrate = useBoardTabsStore((s) => s.hydrate);
  const openTab = useBoardTabsStore((s) => s.openTab);
  const updateTabTitle = useBoardTabsStore((s) => s.updateTabTitle);

  useEffect(() => {
    hydrate(initialTabs, tabLimit, actions.setOpenTabs);
    openTab(currentBoard, currentBoard.id, { force: true });
    // hydrate() is a no-op once the store has been hydrated this session,
    // so on a re-visit after a rename the cached title would persist. Push
    // the freshest server-rendered titles every mount to keep tabs in sync.
    for (const tab of initialTabs) {
      updateTabTitle(tab.id, tab.title);
    }
    updateTabTitle(currentBoard.id, currentBoard.title);
  }, [actions.setOpenTabs, hydrate, openTab, updateTabTitle, initialTabs, currentBoard, tabLimit]);

  return null;
}
