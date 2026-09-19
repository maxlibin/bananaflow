import { NextResponse, type NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { media as mediaTable } from "../../db/schema";
import type { HostAdapter } from "../host/types";
import { findImageJobForUser, markImageJobCancelled } from "../image-jobs";

type Context = { params: Promise<{ jobId: string }> };

export function createImageJobRoute(host: HostAdapter) {
  async function GET(_request: NextRequest, context: Context) {
    const userId = await host.auth.getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { jobId } = await context.params;
    const job = await findImageJobForUser(host.db, jobId, userId);
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let runGroupId: string | null = null;
    let mediaRows: Array<{
      id: string;
      url: string;
      blobPath: string | null;
      fileName: string | null;
      fileSize: number | null;
    }> = [];
    if (job.status === "completed" && job.resultMediaIds?.length) {
      const rows = await host.db
        .select({
          id: mediaTable.id,
          url: mediaTable.url,
          blobPath: mediaTable.blobPath,
          fileName: mediaTable.fileName,
          fileSize: mediaTable.fileSize,
          runGroupId: mediaTable.runGroupId,
        })
        .from(mediaTable)
        .where(inArray(mediaTable.id, job.resultMediaIds));
      runGroupId = rows[0]?.runGroupId ?? null;
      mediaRows = rows.map((r) => ({
        id: r.id,
        url: r.url,
        blobPath: r.blobPath,
        fileName: r.fileName,
        fileSize: r.fileSize,
      }));
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      error: job.errorMessage ?? undefined,
      imageUrls: job.resultBlobUrls ?? [],
      mediaIds: job.resultMediaIds ?? [],
      runGroupId,
      media: mediaRows,
      prompt: job.promptSnapshot,
      nodeId: job.nodeId,
    });
  }

  async function DELETE(_request: NextRequest, context: Context) {
    const userId = await host.auth.getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { jobId } = await context.params;
    const job = await findImageJobForUser(host.db, jobId, userId);
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      job.status === "completed" ||
      job.status === "failed" ||
      job.status === "cancelled"
    ) {
      return NextResponse.json({ ok: true, status: job.status });
    }
    await host.policy.afterGenerate({
      kind: "image",
      status: "cancelled",
      userId,
      jobId: job.id,
      reservedMicro: job.reservedMicro,
      reason: "User cancelled",
    });
    await markImageJobCancelled(host.db, job.id);
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return { GET, DELETE };
}
