"use client";

import type { ReactNode } from "react";
import { CanvasHostProvider, type CanvasHost } from "../components/canvas-host/context";
import { notifyDialog } from "../components/ui/dialog-host";
import { LOCAL_CANVAS_MODELS } from "./local/providers";
import {
  createBoard,
  deleteBoard,
  deleteMedia,
  getBoard,
  getBoardHistory,
  getBoardSummaries,
  getBulkRun,
  pinMedia,
  runVariations,
  setOpenTabs,
  updateBoard,
} from "./actions";

const localCanvasHost: CanvasHost = {
  models: LOCAL_CANVAS_MODELS,
  actions: {
    createBoard,
    updateBoard,
    deleteBoard,
    getBoard,
    getBoardSummaries,
    setOpenTabs,
    getBoardHistory,
    runVariations,
    pinMedia,
    getBulkRun,
    deleteMedia,
  },
  // No credit system: the provider bills the user's own key.
  costPreview: () => null,
  onLimit: (notice) => {
    void notifyDialog({ title: "Limit reached", description: notice.message });
  },
  onGenerationSettled: () => {},
  track: () => {},
};

export function LocalCanvasHostProvider({ children }: { children: ReactNode }) {
  return <CanvasHostProvider value={localCanvasHost}>{children}</CanvasHostProvider>;
}
