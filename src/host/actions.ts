"use server";

import { host } from "./index";
import * as boards from "../lib/actions/boards";
import * as bulkRuns from "../lib/actions/bulk-runs";
import * as media from "../lib/actions/media";
import * as runHistory from "../lib/actions/run-history";
import * as script from "../lib/actions/script";
import * as sequence from "../lib/actions/sequence";
import * as userPreferences from "../lib/actions/user-preferences";
import type { MediaListOptions } from "../lib/actions/media";
import type { CreateBoardData, UpdateBoardData } from "../types/board";

// Server-action wrappers. Next.js requires each action to be a plain async
// function exported from a "use server" module, so every engine action is
// bound to the host here and handed to the canvas through CanvasHost.actions.

export async function createBoard(data: CreateBoardData) {
  return boards.createBoard(host, data);
}

export async function updateBoard(id: string, data: UpdateBoardData) {
  return boards.updateBoard(host, id, data);
}

export async function deleteBoard(id: string) {
  return boards.deleteBoard(host, id);
}

export async function getBoard(id: string) {
  return boards.getBoard(host, id);
}

export async function getAllBoards() {
  return boards.getAllBoards(host);
}

export async function getOpenTabs() {
  return userPreferences.getOpenTabs(host);
}

export async function setOpenTabs(boardIds: string[]) {
  return userPreferences.setOpenTabs(host, boardIds);
}

export async function getTabLimit() {
  return userPreferences.getTabLimit(host);
}

export async function getBoardSummaries() {
  return userPreferences.getBoardSummaries(host);
}

export async function getBoardHistory(boardId: string) {
  return runHistory.getBoardHistory(host, boardId);
}

export async function runVariations(parentMediaId: string, variants: number) {
  return runHistory.runVariations(host, parentMediaId, variants);
}

export async function pinMedia(mediaId: string, pinned: boolean) {
  return runHistory.pinMedia(host, mediaId, pinned);
}

export async function getBulkRun(id: string) {
  return bulkRuns.getBulkRun(host, id);
}

export async function getAllMedia(options?: MediaListOptions) {
  return media.getAllMedia(host, options);
}

export async function deleteMedia(mediaId: string) {
  return media.deleteMedia(host, mediaId);
}

type ScriptInput<K extends keyof typeof script> = Parameters<(typeof script)[K]>[1];

export async function proposeScriptConcepts(input: ScriptInput<"proposeScriptConcepts">) {
  return script.proposeScriptConcepts(host, input);
}

export async function writeScript(input: ScriptInput<"writeScript">) {
  return script.writeScript(host, input);
}

export async function editScriptSelection(input: ScriptInput<"editScriptSelection">) {
  return script.editScriptSelection(host, input);
}

export async function alternativeScriptHooks(input: ScriptInput<"alternativeScriptHooks">) {
  return script.alternativeScriptHooks(host, input);
}

export async function critiqueScript(input: ScriptInput<"critiqueScript">) {
  return script.critiqueScript(host, input);
}

export async function extractScriptEntities(input: ScriptInput<"extractScriptEntities">) {
  return script.extractScriptEntities(host, input);
}

export async function breakScriptIntoShots(input: ScriptInput<"breakScriptIntoShots">) {
  return script.breakScriptIntoShots(host, input);
}

export async function createExportUpload(input: { boardId: string; nodeId: string; size: number }) {
  return sequence.createExportUpload(host, input);
}

export async function saveSequenceExport(input: {
  boardId: string;
  nodeId: string;
  key: string;
  size: number;
  durationSeconds: number;
  width: number;
  height: number;
}) {
  return sequence.saveSequenceExport(host, input);
}
