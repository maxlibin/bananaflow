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
  _request: NextRequest,
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
    "content-length": String(size),
    "cache-control": "public, max-age=31536000, immutable",
  });
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers });
}
