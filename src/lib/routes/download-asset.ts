import { NextResponse, type NextRequest } from "next/server";
import type { HostAdapter } from "../host/types";

export function createDownloadAssetRoute(host: HostAdapter) {
  async function GET(request: NextRequest) {
    const userId = await host.auth.getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl.searchParams.get("url");
    const filename = request.nextUrl.searchParams.get("filename") || "download";

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }

    if (!host.storage.isAllowedAssetUrl(parsed)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

    const upstream = await fetch(parsed.toString());
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 },
      );
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);
    headers.set("content-disposition", `attachment; filename="${safeName}"`);
    headers.set("cache-control", "private, max-age=3600");

    return new NextResponse(upstream.body, { status: 200, headers });
  }

  return { GET };
}
