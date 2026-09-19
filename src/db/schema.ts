import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const cuid = () => createId();

const tstz = (name: string) =>
  timestamp(name, { withTimezone: true, precision: 3, mode: "date" });

const ts = (name: string) => timestamp(name, { precision: 3, mode: "date" });

export const mediaTypeEnum = pgEnum("MediaType", ["IMAGE", "VIDEO"]);

export const mediaSourceEnum = pgEnum("MediaSource", ["node", "chat"]);

export const bulkRunStatusEnum = pgEnum("BulkRunStatus", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "failed",
]);

export const videoJobStatusEnum = pgEnum("VideoJobStatus", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const imageJobStatusEnum = pgEnum("ImageJobStatus", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const boards = pgTable(
  "boards",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: tstz("createdAt").notNull().defaultNow(),
    updatedAt: tstz("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    userId: text("userId").notNull(),
    isPublic: boolean("isPublic").notNull().default(false),
    storageUsed: bigint("storageUsed", { mode: "bigint" }),
    remixedFromBoardId: text("remixedFromBoardId").references(
      (): AnyPgColumn => boards.id,
      { onDelete: "set null" },
    ),
    remixCount: integer("remixCount").notNull().default(0),
    isTemplate: boolean("isTemplate").notNull().default(false),
    thumbnailUrl: text("thumbnailUrl"),
  },
  (table) => [
    index("boards_userId_isPublic_idx").on(table.userId, table.isPublic),
    index("boards_isPublic_remixCount_idx").on(table.isPublic, table.remixCount),
    index("boards_isTemplate_remixCount_idx").on(table.isTemplate, table.remixCount),
  ],
);

export const boardNodes = pgTable(
  "board_nodes",
  {
    id: text("id").primaryKey(),
    boardId: text("boardId")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    position: jsonb("position").notNull(),
    data: jsonb("data").notNull(),
    createdAt: tstz("createdAt").notNull().defaultNow(),
    updatedAt: tstz("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index("board_nodes_boardId_idx").on(table.boardId)],
);

export const boardEdges = pgTable(
  "board_edges",
  {
    id: text("id").primaryKey(),
    boardId: text("boardId")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    target: text("target").notNull(),
    sourceHandle: text("sourceHandle"),
    targetHandle: text("targetHandle"),
    type: text("type"),
    style: jsonb("style"),
    data: jsonb("data"),
    createdAt: tstz("createdAt").notNull().defaultNow(),
    updatedAt: tstz("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index("board_edges_boardId_idx").on(table.boardId)],
);

export const userPreferences = pgTable("user_preferences", {
  userId: text("userId").primaryKey(),
  openBoardIds: jsonb("openBoardIds")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: tstz("createdAt").notNull().defaultNow(),
  updatedAt: tstz("updatedAt")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const videoJobs = pgTable(
  "video_jobs",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    userId: text("userId").notNull(),
    boardId: text("boardId").notNull(),
    nodeId: text("nodeId"),
    chatMessageId: text("chatMessageId"),
    source: mediaSourceEnum("source").notNull().default("node"),
    model: text("model").notNull(),
    promptSnapshot: text("promptSnapshot").notNull(),
    imagesSnapshot: jsonb("imagesSnapshot").$type<
      Array<{ imageUrl: string; blobPath?: string }>
    >(),
    settingsSnapshot: jsonb("settingsSnapshot").notNull(),
    reservedMicro: bigint("reservedMicro", { mode: "bigint" }).notNull(),
    refundedMicro: bigint("refundedMicro", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    providerTaskId: text("providerTaskId"),
    nonce: text("nonce").notNull(),
    status: videoJobStatusEnum("status").notNull().default("pending"),
    errorMessage: text("errorMessage"),
    resultMediaId: text("resultMediaId").references((): AnyPgColumn => media.id, {
      onDelete: "set null",
    }),
    resultBlobPath: text("resultBlobPath"),
    resultBlobUrl: text("resultBlobUrl"),
    parentMediaId: text("parentMediaId"),
    previousBlobPath: text("previousBlobPath"),
    previousSize: integer("previousSize"),
    completedAt: tstz("completedAt"),
    createdAt: tstz("createdAt").notNull().defaultNow(),
    updatedAt: tstz("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("video_jobs_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("video_jobs_status_updatedAt_idx").on(table.status, table.updatedAt),
    uniqueIndex("video_jobs_providerTaskId_unique").on(table.providerTaskId),
  ],
);

export const imageJobs = pgTable(
  "image_jobs",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    userId: text("userId").notNull(),
    boardId: text("boardId").notNull(),
    nodeId: text("nodeId"),
    chatMessageId: text("chatMessageId"),
    source: mediaSourceEnum("source").notNull().default("node"),
    model: text("model").notNull(),
    promptSnapshot: text("promptSnapshot").notNull(),
    imagesSnapshot: jsonb("imagesSnapshot").$type<
      Array<{ imageUrl: string; blobPath?: string }>
    >(),
    settingsSnapshot: jsonb("settingsSnapshot").notNull(),
    variants: integer("variants").notNull().default(1),
    reservedMicro: bigint("reservedMicro", { mode: "bigint" }).notNull(),
    refundedMicro: bigint("refundedMicro", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    providerTaskId: text("providerTaskId"),
    nonce: text("nonce").notNull(),
    status: imageJobStatusEnum("status").notNull().default("pending"),
    errorMessage: text("errorMessage"),
    resultMediaIds: jsonb("resultMediaIds").$type<string[]>(),
    resultBlobPaths: jsonb("resultBlobPaths").$type<string[]>(),
    resultBlobUrls: jsonb("resultBlobUrls").$type<string[]>(),
    parentMediaId: text("parentMediaId"),
    previousBlobPath: text("previousBlobPath"),
    previousSize: integer("previousSize"),
    completedAt: tstz("completedAt"),
    createdAt: tstz("createdAt").notNull().defaultNow(),
    updatedAt: tstz("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("image_jobs_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("image_jobs_status_updatedAt_idx").on(table.status, table.updatedAt),
    uniqueIndex("image_jobs_providerTaskId_unique").on(table.providerTaskId),
  ],
);

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    userId: text("userId").notNull(),
    type: mediaTypeEnum("type").notNull(),
    url: text("url").notNull(),
    blobPath: text("blobPath"),
    fileName: text("fileName"),
    fileSize: integer("fileSize"),
    width: integer("width"),
    height: integer("height"),
    prompt: text("prompt"),
    boardId: text("boardId"),
    nodeId: text("nodeId"),
    runGroupId: text("runGroupId"),
    parentMediaId: text("parentMediaId").references(
      (): AnyPgColumn => media.id,
      { onDelete: "set null" },
    ),
    source: mediaSourceEnum("source").notNull().default("node"),
    chatMessageId: text("chatMessageId"),
    pinned: boolean("pinned").notNull().default(false),
    errorMessage: text("errorMessage"),
    modelSnapshot: jsonb("modelSnapshot"),
    bulkRunId: text("bulkRunId").references((): AnyPgColumn => bulkRuns.id, {
      onDelete: "set null",
    }),
    bulkStatus: bulkRunStatusEnum("bulkStatus"),
    createdAt: tstz("createdAt").notNull().defaultNow(),
    updatedAt: tstz("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("media_userId_idx").on(table.userId),
    index("media_boardId_idx").on(table.boardId),
    index("media_boardId_createdAt_idx").on(table.boardId, table.createdAt),
    index("media_runGroupId_idx").on(table.runGroupId),
    index("media_boardId_pinned_idx")
      .on(table.boardId, table.pinned)
      .where(sql`${table.pinned} = true`),
    index("media_bulkRunId_status_idx").on(table.bulkRunId, table.bulkStatus),
  ],
);

export const bulkRuns = pgTable(
  "bulk_runs",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    userId: text("userId").notNull(),
    boardId: text("boardId").notNull(),
    nodeId: text("nodeId"),
    model: text("model").notNull(),
    settings: jsonb("settings").notNull(),
    templatePrompt: text("templatePrompt").notNull(),
    total: integer("total").notNull(),
    completed: integer("completed").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    cancelled: integer("cancelled").notNull().default(0),
    status: bulkRunStatusEnum("status").notNull().default("pending"),
    reservedMicro: bigint("reservedMicro", { mode: "bigint" }).notNull(),
    refundedMicro: bigint("refundedMicro", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    errorMessage: text("errorMessage"),
    createdAt: tstz("createdAt").notNull().defaultNow(),
    updatedAt: tstz("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("bulk_runs_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("bulk_runs_status_createdAt_idx").on(table.status, table.createdAt),
  ],
);

export const providerKeys = pgTable(
  "provider_keys",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    userId: text("userId").notNull(),
    provider: text("provider").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("authTag").notNull(),
    createdAt: tstz("createdAt").notNull().defaultNow(),
    updatedAt: tstz("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("provider_keys_user_provider_idx").on(table.userId, table.provider)],
);

export const boardsRelations = relations(boards, ({ many, one }) => ({
  nodes: many(boardNodes),
  edges: many(boardEdges),
  remixedFrom: one(boards, {
    fields: [boards.remixedFromBoardId],
    references: [boards.id],
    relationName: "remixedFrom",
  }),
}));

export const boardNodesRelations = relations(boardNodes, ({ one }) => ({
  board: one(boards, { fields: [boardNodes.boardId], references: [boards.id] }),
}));

export const boardEdgesRelations = relations(boardEdges, ({ one }) => ({
  board: one(boards, { fields: [boardEdges.boardId], references: [boards.id] }),
}));

export const mediaRelations = relations(media, ({ many, one }) => ({
  parent: one(media, {
    fields: [media.parentMediaId],
    references: [media.id],
    relationName: "mediaParent",
  }),
  bulkRun: one(bulkRuns, {
    fields: [media.bulkRunId],
    references: [bulkRuns.id],
  }),
}));

export const bulkRunsRelations = relations(bulkRuns, ({ many }) => ({
  items: many(media),
}));

export const videoJobsRelations = relations(videoJobs, ({ one }) => ({
  resultMedia: one(media, {
    fields: [videoJobs.resultMediaId],
    references: [media.id],
  }),
}));

export type Board = typeof boards.$inferSelect;
export type BoardNode = typeof boardNodes.$inferSelect;
export type BoardEdge = typeof boardEdges.$inferSelect;
export type Media = typeof media.$inferSelect;
export type BulkRun = typeof bulkRuns.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type VideoJob = typeof videoJobs.$inferSelect;
export type VideoJobStatus = (typeof videoJobStatusEnum.enumValues)[number];
export type ImageJob = typeof imageJobs.$inferSelect;
export type ImageJobStatus = (typeof imageJobStatusEnum.enumValues)[number];
export type ProviderKey = typeof providerKeys.$inferSelect;

export type MediaTypeValue = (typeof mediaTypeEnum.enumValues)[number];
export type MediaSourceValue = (typeof mediaSourceEnum.enumValues)[number];
export type BulkRunStatusValue = (typeof bulkRunStatusEnum.enumValues)[number];
