import type { Edge, Node } from "@xyflow/react";

export interface Board {
  id: string;
  title: string;
  description?: string | null;
  isPublic: boolean;
  storageUsed?: number;
  createdAt: Date;
  updatedAt: Date;
  nodeCount?: number;
  edgeCount?: number;
  nodes?: Node[];
  edges?: Edge[];
  thumbnailUrl?: string | null;
  remixedFromBoardId?: string | null;
  remixCount?: number;
  isTemplate?: boolean;
}

export interface CreateBoardData {
  title: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateBoardData {
  title?: string;
  description?: string;
  isPublic?: boolean;
  nodes?: Node[];
  edges?: Edge[];
}

export interface TemplateListEntry {
  id: string;
  title: string;
  description: string | null;
  remixCount: number;
  thumbnailUrl: string | null;
  createdAt: Date;
  isTemplate?: boolean;
}

export type PublicBoardSort = "popular" | "recent" | "alpha";

export interface PublicBoardsQuery {
  search?: string;
  sort?: PublicBoardSort;
  page?: number;
  pageSize?: number;
  featuredOnly?: boolean;
}

export interface PublicBoardsResult {
  boards: TemplateListEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
