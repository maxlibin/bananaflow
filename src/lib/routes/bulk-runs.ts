import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { bulkRuns, media } from "../../db/schema";
import { BULK_MAX_EXPANSION } from "../bulk-limits";
import { expandWildcards } from "../bulk-wildcards";
import { denialResponse } from "../host/denial-response";
import type { HostAdapter } from "../host/types";
import { isProviderEnabled } from "../providers";
import type { ModelSnapshot } from "../../types/run-history";

type Context = { params: Promise<{ id: string }> };

export function createBulkGenerateRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    const userId = await host.auth.getUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      boardId,
      nodeId,
      prompt,
      model,
      settings,
      images,
    } = body as {
      boardId?: string;
      nodeId?: string;
      prompt?: string;
      model?: string;
      settings?: Record<string, unknown>;
      images?: Array<{ imageUrl: string; nodeId?: string; blobPath?: string }>;
    };

    if (!boardId || !prompt || typeof model !== "string") {
      return NextResponse.json(
        { success: false, error: "boardId, prompt and model are required" },
        { status: 400 },
      );
    }
    const modelInfo = host.models.image[model];
    if (!modelInfo || !isProviderEnabled(host, modelInfo.provider)) {
      return NextResponse.json(
        { success: false, error: `Invalid model: ${model}` },
        { status: 400 },
      );
    }

    const cap = await host.limits.bulkExpansionCap(userId);

    let expansion;
    try {
      expansion = expandWildcards(prompt, Math.min(cap, BULK_MAX_EXPANSION));
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Invalid wildcard syntax",
        },
        { status: 400 },
      );
    }

    if (expansion.count <= 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Use the regular Generate button for a single prompt.",
        },
        { status: 400 },
      );
    }

    if (expansion.truncated) {
      return NextResponse.json(
        {
          success: false,
          error: `Prompt expansion (${expansion.count}) exceeds your plan cap (${cap}). Upgrade for larger batches.`,
          upgradeRequired: true,
          feature: "IMAGE_GENERATION",
        },
        { status: 400 },
      );
    }

    const bulkRunId = createId();
    const decision = await host.policy.beforeGenerate({
      kind: "bulk",
      userId,
      bulkRunId,
      boardId,
      model,
      count: expansion.count,
    });
    if (!decision.ok) {
      return denialResponse(decision);
    }
    const requiredMicro = decision.reservedMicro;

    const settingsObj =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>)
        : {};
    const imageRefs = Array.isArray(images) ? images : [];

    const created = await host.db.transaction(async (tx) => {
      const [bulkRun] = await tx
        .insert(bulkRuns)
        .values({
          id: bulkRunId,
          userId,
          boardId,
          nodeId: typeof nodeId === "string" ? nodeId : null,
          model,
          settings: settingsObj,
          templatePrompt: prompt,
          total: expansion.count,
          status: "pending",
          reservedMicro: requiredMicro,
        })
        .returning();

      const rows = expansion.prompts.map((p) => {
        const snapshot: ModelSnapshot = {
          kind: "image",
          model,
          prompt: p,
          images: imageRefs.map((ref) => ({
            imageUrl: ref.imageUrl,
            nodeId: ref.nodeId,
            blobPath: ref.blobPath,
          })),
          settings: settingsObj,
          variants: 1,
        };
        return {
          userId,
          boardId,
          nodeId: typeof nodeId === "string" ? nodeId : null,
          type: "IMAGE" as const,
          url: "",
          prompt: p,
          runGroupId: bulkRun.id,
          bulkRunId: bulkRun.id,
          bulkStatus: "pending" as const,
          source: "node" as const,
          modelSnapshot: snapshot as unknown as Record<string, unknown>,
        };
      });
      await tx.insert(media).values(rows);
      return bulkRun;
    });

    return NextResponse.json({
      success: true,
      bulkRunId: created.id,
      total: expansion.count,
      reservedMicro: requiredMicro.toString(),
    });
  }

  return { POST };
}

export function createBulkRunRoute(host: HostAdapter) {
  async function GET(_req: NextRequest, ctx: Context) {
    const { id } = await ctx.params;
    const userId = await host.auth.getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [run] = await host.db
      .select()
      .from(bulkRuns)
      .where(and(eq(bulkRuns.id, id), eq(bulkRuns.userId, userId)))
      .limit(1);
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const items = await host.db
      .select({
        id: media.id,
        url: media.url,
        prompt: media.prompt,
        bulkStatus: media.bulkStatus,
        errorMessage: media.errorMessage,
      })
      .from(media)
      .where(eq(media.bulkRunId, id))
      .orderBy(asc(media.createdAt));
    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        boardId: run.boardId,
        status: run.status,
        total: run.total,
        completed: run.completed,
        failed: run.failed,
        cancelled: run.cancelled,
        model: run.model,
        templatePrompt: run.templatePrompt,
        createdAt: run.createdAt.toISOString(),
        items,
      },
    });
  }

  return { GET };
}

export function createBulkRunCancelRoute(host: HostAdapter) {
  async function POST(_req: NextRequest, ctx: Context) {
    const { id } = await ctx.params;
    const userId = await host.auth.getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [run] = await host.db
      .select()
      .from(bulkRuns)
      .where(and(eq(bulkRuns.id, id), eq(bulkRuns.userId, userId)))
      .limit(1);
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await host.db
      .update(media)
      .set({ bulkStatus: "cancelled" })
      .where(and(eq(media.bulkRunId, id), eq(media.bulkStatus, "pending")))
      .returning({ id: media.id });

    const cancelledCount = updated.length;
    if (cancelledCount === 0) {
      return NextResponse.json({ success: true, cancelledCount: 0 });
    }

    await host.db
      .update(bulkRuns)
      .set({
        cancelled: sql`${bulkRuns.cancelled} + ${cancelledCount}`,
        status:
          run.completed + run.failed + cancelledCount >= run.total
            ? "cancelled"
            : run.status,
      })
      .where(eq(bulkRuns.id, id));

    await host.policy.afterGenerate({
      kind: "bulk",
      status: "cancelled",
      userId,
      bulkRunId: id,
      model: run.model,
      cancelledCount,
    });

    return NextResponse.json({ success: true, cancelledCount });
  }

  return { POST };
}
