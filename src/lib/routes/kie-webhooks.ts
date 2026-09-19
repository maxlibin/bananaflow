import { NextResponse, type NextRequest } from "next/server";
import type { HostAdapter } from "../host/types";
import { applyImageTaskStatus, findImageJob } from "../image-jobs";
import { IMAGE_MODELS, VIDEO_MODELS } from "../model-registry";
import { getProvider } from "../providers";
import { UnsupportedCallbackError } from "../providers/types";
import { applyVideoTaskStatus, findVideoJob } from "../video-jobs";

type Context = { params: Promise<{ jobId: string; nonce: string }> };

// The nonce in the URL is the whole authentication: Kie has no signing
// secret, and the nonce is an unguessable cuid stored on the job row.
export function createKieImageWebhookRoute(host: HostAdapter) {
  async function POST(request: NextRequest, context: Context) {
    const { jobId, nonce } = await context.params;
    const job = await findImageJob(host.db, jobId);

    if (!job) {
      return NextResponse.json({ ok: false, error: "Unknown job" }, { status: 404 });
    }
    if (job.nonce !== nonce) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const payload = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 });
    }

    const info = IMAGE_MODELS[job.model];
    if (!info) {
      return NextResponse.json({ ok: false, error: "Unknown model" }, { status: 400 });
    }
    try {
      const status = getProvider(info.provider).parseImageCallback(job.model, payload);
      const outcome = await applyImageTaskStatus(host, job, status);
      return NextResponse.json({ ok: true, ...outcome });
    } catch (err) {
      if (err instanceof UnsupportedCallbackError) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
      }
      console.error("[webhook][kie/image] unexpected error", { jobId, err });
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
    }
  }

  return { POST };
}

export function createKieVideoWebhookRoute(host: HostAdapter) {
  async function POST(request: NextRequest, context: Context) {
    const { jobId, nonce } = await context.params;
    const job = await findVideoJob(host.db, jobId);

    if (!job) {
      return NextResponse.json({ ok: false, error: "Unknown job" }, { status: 404 });
    }
    if (job.nonce !== nonce) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const payload = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 });
    }

    const info = VIDEO_MODELS[job.model];
    if (!info) {
      return NextResponse.json({ ok: false, error: "Unknown model" }, { status: 400 });
    }
    try {
      const status = getProvider(info.provider).parseVideoCallback(job.model, payload);
      const outcome = await applyVideoTaskStatus(host, job, status);
      return NextResponse.json({ ok: true, ...outcome });
    } catch (err) {
      if (err instanceof UnsupportedCallbackError) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
      }
      console.error("[webhook][kie/video] unexpected error", { jobId, err });
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
    }
  }

  return { POST };
}
