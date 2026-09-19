"use server";

import { host } from "./index";
import * as boards from "../lib/actions/boards";
import * as bulkRuns from "../lib/actions/bulk-runs";
import * as media from "../lib/actions/media";
import * as runHistory from "../lib/actions/run-history";
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
