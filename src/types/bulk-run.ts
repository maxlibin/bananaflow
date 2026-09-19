import type { BulkRun, BulkRunStatusValue } from "../db/schema";

export type BulkRunStatus = BulkRunStatusValue;

export type { BulkRun };

export type BulkRunItem = {
  id: string;
  url: string | null;
  prompt: string;
  bulkStatus: BulkRunStatus;
  errorMessage: string | null;
};

export type BulkRunWithItems = {
  id: string;
  boardId: string;
  status: BulkRunStatus;
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  model: string;
  templatePrompt: string;
  createdAt: string;
  items: BulkRunItem[];
};
