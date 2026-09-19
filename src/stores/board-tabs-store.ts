"use client";

import { create } from "zustand";

import type { CanvasActions } from "../components/canvas-host/context";
import { MAX_OPEN_TABS } from "../lib/board-tabs-constants";

export type BoardTab = { id: string; title: string };

const BOARD_DELETED_EVENT = "banana-flow:board-deleted";
const PERSIST_DEBOUNCE_MS = 400;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistTabs: CanvasActions["setOpenTabs"] | null = null;
let listenerInstalled = false;

type OpenTabResult = "opened" | "duplicate" | "limit";

type OpenTabOptions = { force?: boolean };

type BoardTabsStore = {
  tabs: BoardTab[];
  hydrated: boolean;
  tabLimit: number;
  hydrate: (
    tabs: BoardTab[],
    tabLimit: number,
    setOpenTabs: CanvasActions["setOpenTabs"],
  ) => void;
  openTab: (
    tab: BoardTab,
    activeBoardId: string | null,
    options?: OpenTabOptions,
  ) => OpenTabResult;
  closeTab: (id: string, activeBoardId: string | null) => string | null;
  updateTabTitle: (id: string, title: string) => void;
};

export const useBoardTabsStore = create<BoardTabsStore>((set, get) => ({
  tabs: [],
  hydrated: false,
  tabLimit: MAX_OPEN_TABS,

  hydrate: (tabs, tabLimit, setOpenTabs) => {
    persistTabs = setOpenTabs;
    if (get().hydrated) {
      if (get().tabLimit !== tabLimit) set({ tabLimit });
      return;
    }
    set({ tabs, tabLimit, hydrated: true });
    installDeletedListener(set, get);
  },

  openTab: (tab, activeBoardId, options) => {
    const current = get().tabs;
    if (current.some((t) => t.id === tab.id)) return "duplicate";

    const limit = get().tabLimit;
    if (current.length >= limit) {
      if (!options?.force) return "limit";
      let next = [...current, tab];
      const evictIndex = next.findIndex((t) => t.id !== activeBoardId);
      if (evictIndex >= 0) next.splice(evictIndex, 1);
      else next = next.slice(-limit);
      set({ tabs: next });
      schedulePersist(next.map((t) => t.id));
      return "opened";
    }

    const next = [...current, tab];
    set({ tabs: next });
    schedulePersist(next.map((t) => t.id));
    return "opened";
  },

  closeTab: (id, activeBoardId) => {
    const current = get().tabs;
    const idx = current.findIndex((t) => t.id === id);
    if (idx < 0) return null;

    const next = [...current.slice(0, idx), ...current.slice(idx + 1)];
    set({ tabs: next });
    schedulePersist(next.map((t) => t.id));

    if (activeBoardId !== id) return null;
    if (next.length === 0) return null;
    const neighbor = next[idx] ?? next[idx - 1] ?? next[0];
    return neighbor?.id ?? null;
  },

  updateTabTitle: (id, title) => {
    const current = get().tabs;
    const idx = current.findIndex((t) => t.id === id);
    if (idx < 0) return;
    if (current[idx].title === title) return;
    const next = [...current];
    next[idx] = { ...next[idx], title };
    set({ tabs: next });
  },
}));

function schedulePersist(ids: string[]) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistWithRetry(ids);
  }, PERSIST_DEBOUNCE_MS);
}

async function persistWithRetry(ids: string[]) {
  const setOpenTabs = persistTabs;
  if (!setOpenTabs) {
    throw new Error("board-tabs store used before hydrate() supplied setOpenTabs");
  }
  try {
    const r = await setOpenTabs(ids);
    if (r.success) return;
    throw new Error("setOpenTabs returned success=false");
  } catch (err1) {
    try {
      await setOpenTabs(ids);
    } catch (err2) {
      console.error("[board-tabs] failed to persist tabs", err1, err2);
    }
  }
}

function installDeletedListener(
  set: (
    partial:
      | Partial<BoardTabsStore>
      | ((state: BoardTabsStore) => Partial<BoardTabsStore>),
  ) => void,
  get: () => BoardTabsStore,
) {
  if (listenerInstalled) return;
  if (typeof window === "undefined") return;
  listenerInstalled = true;

  window.addEventListener(BOARD_DELETED_EVENT, ((event: Event) => {
    const detail = (event as CustomEvent<{ boardId?: string }>).detail;
    const boardId = detail?.boardId;
    if (!boardId) return;
    const current = get().tabs;
    if (!current.some((t) => t.id === boardId)) return;
    const next = current.filter((t) => t.id !== boardId);
    set({ tabs: next });
    schedulePersist(next.map((t) => t.id));
  }) as EventListener);
}
