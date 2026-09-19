CREATE TYPE "public"."BulkRunStatus" AS ENUM('pending', 'in_progress', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ImageJobStatus" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."MediaSource" AS ENUM('node', 'chat');--> statement-breakpoint
CREATE TYPE "public"."MediaType" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."VideoJobStatus" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "board_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"boardId" text NOT NULL,
	"source" text NOT NULL,
	"target" text NOT NULL,
	"sourceHandle" text,
	"targetHandle" text,
	"type" text,
	"style" jsonb,
	"data" jsonb,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"boardId" text NOT NULL,
	"type" text NOT NULL,
	"position" jsonb NOT NULL,
	"data" jsonb NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL,
	"userId" text NOT NULL,
	"isPublic" boolean DEFAULT false NOT NULL,
	"storageUsed" bigint,
	"remixedFromBoardId" text,
	"remixCount" integer DEFAULT 0 NOT NULL,
	"isTemplate" boolean DEFAULT false NOT NULL,
	"thumbnailUrl" text
);
--> statement-breakpoint
CREATE TABLE "bulk_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"boardId" text NOT NULL,
	"nodeId" text,
	"model" text NOT NULL,
	"settings" jsonb NOT NULL,
	"templatePrompt" text NOT NULL,
	"total" integer NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"cancelled" integer DEFAULT 0 NOT NULL,
	"status" "BulkRunStatus" DEFAULT 'pending' NOT NULL,
	"reservedMicro" bigint NOT NULL,
	"refundedMicro" bigint DEFAULT 0 NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"boardId" text NOT NULL,
	"nodeId" text,
	"chatMessageId" text,
	"source" "MediaSource" DEFAULT 'node' NOT NULL,
	"model" text NOT NULL,
	"promptSnapshot" text NOT NULL,
	"imagesSnapshot" jsonb,
	"settingsSnapshot" jsonb NOT NULL,
	"variants" integer DEFAULT 1 NOT NULL,
	"reservedMicro" bigint NOT NULL,
	"refundedMicro" bigint DEFAULT 0 NOT NULL,
	"providerTaskId" text,
	"nonce" text NOT NULL,
	"status" "ImageJobStatus" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"resultMediaIds" jsonb,
	"resultBlobPaths" jsonb,
	"resultBlobUrls" jsonb,
	"parentMediaId" text,
	"previousBlobPath" text,
	"previousSize" integer,
	"completedAt" timestamp (3) with time zone,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" "MediaType" NOT NULL,
	"url" text NOT NULL,
	"blobPath" text,
	"fileName" text,
	"fileSize" integer,
	"width" integer,
	"height" integer,
	"prompt" text,
	"boardId" text,
	"nodeId" text,
	"runGroupId" text,
	"parentMediaId" text,
	"source" "MediaSource" DEFAULT 'node' NOT NULL,
	"chatMessageId" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"errorMessage" text,
	"modelSnapshot" jsonb,
	"bulkRunId" text,
	"bulkStatus" "BulkRunStatus",
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"provider" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"authTag" text NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"userId" text PRIMARY KEY NOT NULL,
	"openBoardIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"boardId" text NOT NULL,
	"nodeId" text,
	"chatMessageId" text,
	"source" "MediaSource" DEFAULT 'node' NOT NULL,
	"model" text NOT NULL,
	"promptSnapshot" text NOT NULL,
	"imagesSnapshot" jsonb,
	"settingsSnapshot" jsonb NOT NULL,
	"reservedMicro" bigint NOT NULL,
	"refundedMicro" bigint DEFAULT 0 NOT NULL,
	"providerTaskId" text,
	"nonce" text NOT NULL,
	"status" "VideoJobStatus" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"resultMediaId" text,
	"resultBlobPath" text,
	"resultBlobUrl" text,
	"parentMediaId" text,
	"previousBlobPath" text,
	"previousSize" integer,
	"completedAt" timestamp (3) with time zone,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_edges" ADD CONSTRAINT "board_edges_boardId_boards_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_nodes" ADD CONSTRAINT "board_nodes_boardId_boards_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_remixedFromBoardId_boards_id_fk" FOREIGN KEY ("remixedFromBoardId") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_parentMediaId_media_id_fk" FOREIGN KEY ("parentMediaId") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_bulkRunId_bulk_runs_id_fk" FOREIGN KEY ("bulkRunId") REFERENCES "public"."bulk_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_resultMediaId_media_id_fk" FOREIGN KEY ("resultMediaId") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_edges_boardId_idx" ON "board_edges" USING btree ("boardId");--> statement-breakpoint
CREATE INDEX "board_nodes_boardId_idx" ON "board_nodes" USING btree ("boardId");--> statement-breakpoint
CREATE INDEX "boards_userId_isPublic_idx" ON "boards" USING btree ("userId","isPublic");--> statement-breakpoint
CREATE INDEX "boards_isPublic_remixCount_idx" ON "boards" USING btree ("isPublic","remixCount");--> statement-breakpoint
CREATE INDEX "boards_isTemplate_remixCount_idx" ON "boards" USING btree ("isTemplate","remixCount");--> statement-breakpoint
CREATE INDEX "bulk_runs_userId_createdAt_idx" ON "bulk_runs" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "bulk_runs_status_createdAt_idx" ON "bulk_runs" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "image_jobs_userId_createdAt_idx" ON "image_jobs" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "image_jobs_status_updatedAt_idx" ON "image_jobs" USING btree ("status","updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "image_jobs_providerTaskId_unique" ON "image_jobs" USING btree ("providerTaskId");--> statement-breakpoint
CREATE INDEX "media_userId_idx" ON "media" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "media_boardId_idx" ON "media" USING btree ("boardId");--> statement-breakpoint
CREATE INDEX "media_boardId_createdAt_idx" ON "media" USING btree ("boardId","createdAt");--> statement-breakpoint
CREATE INDEX "media_runGroupId_idx" ON "media" USING btree ("runGroupId");--> statement-breakpoint
CREATE INDEX "media_boardId_pinned_idx" ON "media" USING btree ("boardId","pinned") WHERE "media"."pinned" = true;--> statement-breakpoint
CREATE INDEX "media_bulkRunId_status_idx" ON "media" USING btree ("bulkRunId","bulkStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_keys_user_provider_idx" ON "provider_keys" USING btree ("userId","provider");--> statement-breakpoint
CREATE INDEX "video_jobs_userId_createdAt_idx" ON "video_jobs" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "video_jobs_status_updatedAt_idx" ON "video_jobs" USING btree ("status","updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "video_jobs_providerTaskId_unique" ON "video_jobs" USING btree ("providerTaskId");