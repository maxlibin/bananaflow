import type { LanguageModel } from "ai";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as engineSchema from "../../db/schema";
import type { AdvancedOpId } from "../advanced-ops";
import type { ImageModelInfo, VideoModelInfo, SpeechModelInfo } from "../model-registry";
import type { TextModelOption } from "../model-options";
import type { Provider, ProviderId } from "../providers/types";
import type { GenerationFeature } from "./features";

export type EngineSchema = typeof engineSchema;

// Any Drizzle Postgres database whose schema includes the engine tables.
// The SaaS passes a Neon database with extra tables; the open-source app
// passes a node-postgres database with exactly the engine schema.
export type EngineDatabase = PgDatabase<
  PgQueryResultHKT,
  EngineSchema,
  ExtractTablesWithRelations<EngineSchema>
>;

export type Denial = {
  ok: false;
  status: 402 | 403 | 429;
  code: string | null;
  message: string;
  feature: GenerationFeature;
  upgradeRequired: boolean;
  plan: string | null;
  retryAfterMs: number | null;
};

export type LimitDecision = { ok: true } | Denial;

export type GenerationRequest =
  | {
      kind: "image";
      userId: string;
      jobId: string;
      boardId: string;
      model: string;
      variants: number;
    }
  | {
      kind: "video";
      userId: string;
      jobId: string;
      boardId: string;
      model: string;
      // What the provider will generate (see Provider.describeVideoTask).
      durationSeconds: number;
      resolution: string | undefined;
      generateAudio: boolean;
    }
  | {
      kind: "advanced";
      userId: string;
      requestId: string;
      op: AdvancedOpId;
      feature: GenerationFeature;
    }
  | {
      kind: "bulk";
      userId: string;
      bulkRunId: string;
      boardId: string;
      model: string;
      count: number;
    }
  | {
      kind: "speech";
      userId: string;
      requestId: string;
      boardId: string;
      model: string;
      characters: number;
    };

export type GenerationDecision = { ok: true; reservedMicro: bigint } | Denial;

export type GenerationOutcome =
  | {
      kind: "image";
      status: "completed";
      userId: string;
      jobId: string;
      model: string;
      count: number;
    }
  | {
      kind: "image";
      status: "failed" | "cancelled";
      userId: string;
      jobId: string;
      reservedMicro: bigint;
      reason: string;
    }
  | {
      kind: "video";
      status: "completed";
      userId: string;
      jobId: string;
      model: string;
    }
  | {
      kind: "video";
      status: "failed" | "cancelled";
      userId: string;
      jobId: string;
      reservedMicro: bigint;
      reason: string;
    }
  | {
      kind: "advanced";
      status: "completed";
      userId: string;
      requestId: string;
      op: AdvancedOpId;
      feature: GenerationFeature;
      boardId: string;
      blobPath: string;
      metadata: Record<string, string | number>;
    }
  | {
      kind: "bulk";
      status: "item_failed" | "item_reaped";
      userId: string;
      bulkRunId: string;
      mediaId: string;
      model: string;
    }
  | {
      kind: "bulk";
      status: "cancelled";
      userId: string;
      bulkRunId: string;
      model: string;
      cancelledCount: number;
    }
  | {
      kind: "bulk";
      status: "settled";
      userId: string;
      bulkRunId: string;
    }
  | {
      kind: "speech";
      status: "completed";
      userId: string;
      requestId: string;
      model: string;
      characters: number;
      boardId: string;
      mediaId: string;
    }
  | {
      kind: "speech";
      status: "failed";
      userId: string;
      requestId: string;
      model: string;
      reason: string;
    };

// One LLM call made for a user (script writing). Hosts that bill text usage
// check and charge it through policy.beforeText / afterText.
export type TextRequest = {
  userId: string;
  task: string;
  model: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
};

export type TextOutcome = {
  userId: string;
  task: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type BoardCreated = {
  userId: string;
  boardId: string;
  remixedFromBoardId: string | null;
};

export type StorageChange = {
  userId: string;
  boardId: string;
  deltaBytes: number;
  source: string;
  blobPath: string | null;
  previousBlobPath: string | null;
  contentType: string | null;
};

export type UploadAssetInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type DirectUpload = { uploadUrl: string; method: "PUT"; headers: Record<string, string> };

export type UploadAssetResult = {
  url: string;
  pathname: string;
};

export type HostAdapter = {
  db: EngineDatabase;
  auth: {
    getUserId(): Promise<string | null>;
  };
  providers: {
    // Provider adapters this deployment offers, in preference order. Advanced
    // ops use the first one that has an editing model.
    list: Provider[];
  };
  models: {
    // Every model the deployment can generate with, keyed by model id
    // ("<provider>/<name>"). Compose from the per-provider maps in
    // model-registry.ts or add your own.
    image: Record<string, ImageModelInfo>;
    video: Record<string, VideoModelInfo>;
    speech: Record<string, SpeechModelInfo>;
  };
  text: {
    // Writing models in picker order; `defaultModelId` for drafting and
    // critique, `fastModelId` for quick inline edits and hook alternatives.
    models: TextModelOption[];
    defaultModelId: string;
    fastModelId: string;
    // The AI SDK model to call for this user (BYOK hosts use the user's key).
    languageModel(userId: string, modelId: string): Promise<LanguageModel>;
  };
  keys: {
    // Throws ProviderKeyMissingError when no key is available for the user.
    resolveProviderKey(userId: string, provider: ProviderId): Promise<string>;
  };
  policy: {
    beforeGenerate(request: GenerationRequest): Promise<GenerationDecision>;
    afterGenerate(outcome: GenerationOutcome): Promise<void>;
    beforeText(request: TextRequest): Promise<LimitDecision>;
    afterText(outcome: TextOutcome): Promise<void>;
  };
  limits: {
    tabLimit(userId: string): Promise<number>;
    canCreateBoard(userId: string): Promise<LimitDecision>;
    canPublishBoard(userId: string): Promise<LimitDecision>;
    canStore(userId: string, deltaBytes: number): Promise<LimitDecision>;
    bulkExpansionCap(userId: string): Promise<number>;
    onBoardCreated(created: BoardCreated): Promise<void>;
    onStorageChanged(change: StorageChange): Promise<void>;
  };
  storage: {
    uploadAsset(input: UploadAssetInput): Promise<UploadAssetResult>;
    isAllowedAssetUrl(url: URL): boolean;
    // Turns a stored asset URL (possibly app-relative) into an absolute URL
    // this server can fetch, e.g. to send reference images to a provider.
    resolveAssetUrl(url: string): string;
    // Direct browser-to-storage upload for large files (the request body
    // limit of serverless hosts is a few MB). `size` is enforced.
    createUpload(input: { key: string; contentType: string; size: number }): Promise<DirectUpload>;
    // Byte size of a stored object, or null when it does not exist.
    getAssetSize(key: string): Promise<number | null>;
    // Public URL for a key written by uploadAsset or createUpload.
    assetUrl(key: string): string;
  };
  callbacks: {
    publicBaseUrl(): string | null;
  };
};
