import { NextRequest, NextResponse } from "next/server";
import { adjustBoardStorage } from "./board-storage";
import { createDebugLogger, isAbortError } from "./generation-utils";
import { denialResponse } from "./host/denial-response";
import { ProviderKeyMissingError } from "./host/errors";
import type { AdvancedOpId } from "./advanced-ops";
import type { HostAdapter } from "./host/types";

const DEBUG = process.env.DEBUG_ADVANCED_OPS === "true";
const { debugLog } = createDebugLogger(DEBUG);

export type AdvancedOpFeature =
  | "IMAGE_UPSCALE"
  | "BACKGROUND_REMOVAL"
  | "FACE_CONSISTENCY";

export type ProviderResult = {
  buffer: ArrayBuffer;
  contentType: string;
  ext: string;
};

export type ProviderCall = (input: {
  signal: AbortSignal;
  requestId: string;
  providerSecret: string;
}) => Promise<ProviderResult>;

export interface AdvancedOperationConfig {
  request: NextRequest;
  op: AdvancedOpId;
  feature: AdvancedOpFeature;
  callProvider: ProviderCall;
  fileNameBase: string;
  extraUsageMetadata: Record<string, string | number>;
}

export interface AdvancedOperationSuccess {
  success: true;
  resultUrl: string;
  blobPath: string;
  sizeBytes: number;
  storageUsed?: number;
}

type BodyShape = {
  boardId?: string;
  previousBlobPath?: string;
  previousSize?: number;
};

export async function parseAdvancedBody(request: NextRequest) {
  const body = (await request.json()) as BodyShape & Record<string, unknown>;
  return body;
}

export async function runAdvancedOperation(
  host: HostAdapter,
  config: AdvancedOperationConfig,
) {
  const requestId = `${config.op}_${crypto.randomUUID()}`;
  const { request, op, feature, callProvider, fileNameBase } = config;

  try {
    if (request.signal.aborted) {
      return NextResponse.json(
        { success: false, error: "Operation canceled", cancelled: true },
        { status: 499 }
      );
    }

    const userId = await host.auth.getUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const decision = await host.policy.beforeGenerate({
      kind: "advanced",
      userId,
      requestId,
      op,
      feature,
    });
    if (!decision.ok) {
      return denialResponse(decision);
    }

    const body = await parseAdvancedBody(request);
    const boardId = typeof body.boardId === "string" ? body.boardId : undefined;
    if (!boardId) {
      return NextResponse.json(
        { success: false, error: "boardId is required" },
        { status: 400 }
      );
    }

    let providerSecret: string;
    try {
      providerSecret = await host.keys.resolveProviderKey(userId, "kie");
    } catch (error) {
      if (!(error instanceof ProviderKeyMissingError)) throw error;
      console.error(`[${op}][config] provider key missing`, {
        requestId,
        message: error.message,
      });
      return NextResponse.json(
        { success: false, error: "Provider not configured" },
        { status: 500 }
      );
    }

    debugLog(`[${op}][start]`, { requestId, userId });

    const result = await callProvider({
      signal: request.signal,
      requestId,
      providerSecret,
    });

    const size = result.buffer.byteLength;
    const previousSize = Number.isFinite(body.previousSize)
      ? Number(body.previousSize)
      : 0;
    const deltaBytes = size - previousSize;

    const storeDecision = await host.limits.canStore(userId, deltaBytes);
    if (!storeDecision.ok) {
      return denialResponse(storeDecision);
    }

    const filename = `${userId}/${fileNameBase}-${Date.now()}.${result.ext}`;
    const blob = await host.storage.uploadAsset({
      key: filename,
      body: Buffer.from(result.buffer),
      contentType: result.contentType,
    });

    let storageUsed: number | undefined;
    if (deltaBytes !== 0) {
      await host.limits.onStorageChanged({
        userId,
        boardId,
        deltaBytes,
        source: op,
        blobPath: blob.pathname,
        previousBlobPath:
          typeof body.previousBlobPath === "string" ? body.previousBlobPath : null,
        contentType: null,
      });
      try {
        storageUsed = await adjustBoardStorage(host.db, userId, boardId, deltaBytes);
      } catch (error) {
        console.error(`[${op}] adjustBoardStorage failed`, error);
      }
    } else {
      try {
        storageUsed = await adjustBoardStorage(host.db, userId, boardId, 0);
      } catch (error) {
        console.error(`[${op}] adjustBoardStorage read failed`, error);
      }
    }

    await host.policy.afterGenerate({
      kind: "advanced",
      status: "completed",
      userId,
      requestId,
      op,
      feature,
      boardId,
      blobPath: blob.pathname,
      metadata: config.extraUsageMetadata,
    });

    const payload: AdvancedOperationSuccess = {
      success: true,
      resultUrl: blob.url,
      blobPath: blob.pathname ?? blob.url,
      sizeBytes: size,
      storageUsed,
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json(
        { success: false, error: "Operation canceled", cancelled: true },
        { status: 499 }
      );
    }

    console.error(`[${config.op}][exception]`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
