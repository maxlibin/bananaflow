"use client";

import { createContext, useContext, type ReactNode } from "react";
import type * as boards from "../../lib/actions/boards";
import type * as bulkRuns from "../../lib/actions/bulk-runs";
import type * as media from "../../lib/actions/media";
import type * as runHistory from "../../lib/actions/run-history";
import type * as script from "../../lib/actions/script";
import type * as userPreferences from "../../lib/actions/user-preferences";
import type { AdvancedOpId } from "../../lib/advanced-ops";
import type { GenerationFeature } from "../../lib/host/features";
import type { HostAdapter } from "../../lib/host/types";
import type { VideoModelSettings } from "../../lib/video-models";
import type { CanvasModels } from "../../lib/model-options";
import type { ScriptAssistant } from "../../lib/script/assistant";
import type { DirectionSamples } from "../../lib/direction/presets";
import type { TrackFn } from "../../lib/track-events";

// The engine exports action implementations that take the host first. An
// app wraps them in a "use server" file and hands the wrappers to the canvas
// through this context, so the canvas never imports server code directly.
type WithoutHost<F> = F extends (host: HostAdapter, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;

export type CanvasActions = {
  createBoard: WithoutHost<typeof boards.createBoard>;
  updateBoard: WithoutHost<typeof boards.updateBoard>;
  deleteBoard: WithoutHost<typeof boards.deleteBoard>;
  getBoard: WithoutHost<typeof boards.getBoard>;
  getBoardSummaries: WithoutHost<typeof userPreferences.getBoardSummaries>;
  setOpenTabs: WithoutHost<typeof userPreferences.setOpenTabs>;
  getBoardHistory: WithoutHost<typeof runHistory.getBoardHistory>;
  runVariations: WithoutHost<typeof runHistory.runVariations>;
  pinMedia: WithoutHost<typeof runHistory.pinMedia>;
  getBulkRun: WithoutHost<typeof bulkRuns.getBulkRun>;
  deleteMedia: WithoutHost<typeof media.deleteMedia>;
  proposeScriptConcepts: WithoutHost<typeof script.proposeScriptConcepts>;
  writeScript: WithoutHost<typeof script.writeScript>;
  editScriptSelection: WithoutHost<typeof script.editScriptSelection>;
  alternativeScriptHooks: WithoutHost<typeof script.alternativeScriptHooks>;
  critiqueScript: WithoutHost<typeof script.critiqueScript>;
  extractScriptEntities: WithoutHost<typeof script.extractScriptEntities>;
  breakScriptIntoShots: WithoutHost<typeof script.breakScriptIntoShots>;
};

export type CostPreviewInput =
  | { kind: "image"; model: string; count: number }
  // The node's settings as sent to /api/generate-video; the host prices them
  // the way the server will (resolveVideoSettings + describeVideoTask).
  | { kind: "video"; model: string; settings: Partial<VideoModelSettings>; hasImage: boolean }
  | { kind: "advanced"; op: AdvancedOpId }
  | { kind: "bulk"; model: string; count: number };

// Whole credits, not rounded. Render sites apply their own rounding.
export type CostPreview = { credits: number };

export type LimitNotice = {
  feature: GenerationFeature;
  kind: "out_of_credits" | "rate_limit" | "storage" | "plan";
  severity: "warning" | "critical";
  message: string;
  plan: string | null;
};

export type CanvasHost = {
  actions: CanvasActions;
  // Models this deployment can generate with, in picker order, plus their
  // per-model setting options.
  models: CanvasModels;
  // Returns null when the host has no notion of cost (open-source BYOK build).
  costPreview: (input: CostPreviewInput) => CostPreview | null;
  onLimit: (notice: LimitNotice) => void;
  // Called after a generation or bulk run starts or settles, so a host can
  // refresh balances or analytics.
  onGenerationSettled: () => void;
  track: TrackFn;
  // AI writing help for Script nodes; null when the host has no LLM.
  scriptAssistant: ScriptAssistant | null;
  // Sample media per direction preset, keyed by directionSampleKey(); presets
  // without one show their description only.
  directionSamples: DirectionSamples;
};

const CanvasHostContext = createContext<CanvasHost | null>(null);

export function CanvasHostProvider({
  value,
  children,
}: {
  value: CanvasHost;
  children: ReactNode;
}) {
  return (
    <CanvasHostContext.Provider value={value}>
      {children}
    </CanvasHostContext.Provider>
  );
}

export function useCanvasHost(): CanvasHost {
  const host = useContext(CanvasHostContext);
  if (!host) {
    throw new Error("useCanvasHost must be used within a CanvasHostProvider");
  }
  return host;
}
