import { NextResponse, type NextRequest } from "next/server";
import type { HostAdapter } from "../host/types";
import { pollImageJobs } from "../scheduler/poll-image-jobs";
import { pollVideoJobs } from "../scheduler/poll-video-jobs";
import { processBulk } from "../scheduler/process-bulk";

// Cron routes authenticate with `Authorization: Bearer <cronSecret>` so an
// external scheduler (Vercel Cron, GitHub Actions, curl) can drive the pollers.
export function createCronRoutes(host: HostAdapter, cronSecret: string) {
  function authorized(request: NextRequest): boolean {
    return request.headers.get("authorization") === `Bearer ${cronSecret}`;
  }

  return {
    pollImageJobs: {
      async GET(request: NextRequest) {
        if (!authorized(request)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json({ ok: true, ...(await pollImageJobs(host)) });
      },
    },
    pollVideoJobs: {
      async GET(request: NextRequest) {
        if (!authorized(request)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json({ ok: true, ...(await pollVideoJobs(host)) });
      },
    },
    processBulk: {
      async GET(request: NextRequest) {
        if (!authorized(request)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json({ success: true, ...(await processBulk(host, request.signal)) });
      },
    },
  };
}
