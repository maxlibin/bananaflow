"use client";

import type { ReactNode } from "react";
import { CanvasHostProvider, type CanvasHost } from "../components/canvas-host/context";
import { notifyDialog } from "../components/ui/dialog-host";
import { LOCAL_CANVAS_MODELS } from "./local/providers";
import { LOCAL_DEFAULT_TEXT_MODEL, LOCAL_TEXT_MODELS } from "./local/text-models";
import { createScriptAssistant } from "../lib/script/create-script-assistant";
import {
  alternativeScriptHooks,
  breakScriptIntoShots,
  createExportUpload,
  saveSequenceExport,
  createBoard,
  critiqueScript,
  editScriptSelection,
  extractScriptEntities,
  proposeScriptConcepts,
  writeScript,
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

const actions: CanvasHost["actions"] = {
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
  proposeScriptConcepts,
  writeScript,
  editScriptSelection,
  alternativeScriptHooks,
  critiqueScript,
  extractScriptEntities,
  breakScriptIntoShots,
  createExportUpload,
  saveSequenceExport,
};

const onLimit: CanvasHost["onLimit"] = (notice) => {
  void notifyDialog({ title: "Limit reached", description: notice.message });
};

const onGenerationSettled = () => {};

const localCanvasHost: CanvasHost = {
  models: LOCAL_CANVAS_MODELS,
  actions,
  // No credit system: the provider bills the user's own key.
  costPreview: () => null,
  scriptAssistant: createScriptAssistant({
    actions,
    models: LOCAL_TEXT_MODELS,
    defaultModelId: LOCAL_DEFAULT_TEXT_MODEL,
    onLimit,
    onSettled: onGenerationSettled,
  }),
  onLimit,
  onGenerationSettled,
  track: () => {},
  directionSamples: {},
};

export function LocalCanvasHostProvider({ children }: { children: ReactNode }) {
  return <CanvasHostProvider value={localCanvasHost}>{children}</CanvasHostProvider>;
}
