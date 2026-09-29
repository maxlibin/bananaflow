import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { UPLOADS_DIR } from "../../../host/local/storage";
import { resolveLocalAssetPath, UnsafeStorageKeyError } from "../../../lib/storage/local-disk";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
};

// Serves files written by the local-disk storage adapter.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  const key = segments.map(decodeURIComponent).join("/");

  let filePath: string;
  try {
    filePath = resolveLocalAssetPath(UPLOADS_DIR, key);
  } catch (error) {
    if (error instanceof UnsafeStorageKeyError) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    throw error;
  }

  let size: number;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    size = info.size;
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const headers = new Headers({
    "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
  });

  // Browsers read video metadata and seek with Range requests; a plain 200
  // leaves an MP4 stuck loading.
  const range = parseRange(request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    headers.set("content-range", `bytes */${size}`);
    return new NextResponse(null, { status: 416, headers });
  }
  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("content-length", String(range.end - range.start + 1));
    const stream = Readable.toWeb(createReadStream(filePath, range)) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers });
  }
  headers.set("content-length", String(size));
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers });
}

// Single byte range ("bytes=a-b", "bytes=a-", "bytes=-n"); null when absent.
function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (match[1] === "" && match[2] === "")) return null;
  const start = match[1] === "" ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = match[1] === "" || match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}
