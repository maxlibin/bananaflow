import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { media as mediaTable } from "../../db/schema";
import type { HostAdapter } from "../host/types";
import { findVideoJobForUser, markVideoJobCancelled } from "../video-jobs";

type Context = { params: Promise<{ jobId: string }> };

export function createVideoJobRoute(host: HostAdapter) {
  async function GET(_request: NextRequest, context: Context) {
    const userId = await host.auth.getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { jobId } = await context.params;
    const job = await findVideoJobForUser(host.db, jobId, userId);
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let runGroupId: string | null = null;
    let fileSize: number | null = null;
    let fileName: string | null = null;
    if (job.status === "completed" && job.resultMediaId) {
      const [row] = await host.db
        .select({
          runGroupId: mediaTable.runGroupId,
          fileSize: mediaTable.fileSize,
          fileName: mediaTable.fileName,
        })
        .from(mediaTable)
        .where(eq(mediaTable.id, job.resultMediaId))
        .limit(1);
      if (row) {
        runGroupId = row.runGroupId ?? null;
        fileSize = row.fileSize ?? null;
        fileName = row.fileName ?? null;
      }
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      error: job.errorMessage ?? undefined,
      videoUrl: job.resultBlobUrl ?? undefined,
      blobPath: job.resultBlobPath ?? undefined,
      mediaId: job.resultMediaId ?? undefined,
      runGroupId,
      fileSize,
      fileName,
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
    const job = await findVideoJobForUser(host.db, jobId, userId);
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
      kind: "video",
      status: "cancelled",
      userId,
      jobId: job.id,
      reservedMicro: job.reservedMicro,
      reason: "User cancelled",
    });
    await markVideoJobCancelled(host.db, job.id);
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return { GET, DELETE };
}
