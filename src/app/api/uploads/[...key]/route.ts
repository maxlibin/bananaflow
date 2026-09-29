import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { UPLOADS_DIR } from "../../../../host/local/storage";
import { resolveLocalAssetPath, UnsafeStorageKeyError } from "../../../../lib/storage/local-disk";
import { InvalidUploadTokenError, verifyUploadToken } from "../../../../lib/storage/upload-token";

// Receives direct uploads for the local-disk storage adapter (see
// createLocalDiskStorage.createUpload). S3 deployments upload to the bucket.
export async function PUT(request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  const secret = process.env.APP_SECRET;
  if (!secret) return NextResponse.json({ error: "APP_SECRET is not set" }, { status: 500 });
  const { key: segments } = await context.params;
  const key = segments.map(decodeURIComponent).join("/");
  const body = Buffer.from(await request.arrayBuffer());
  try {
    verifyUploadToken(secret, request.nextUrl.searchParams.get("token") ?? "", key, body.byteLength, Date.now());
    const target = resolveLocalAssetPath(UPLOADS_DIR, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  } catch (error) {
    if (error instanceof InvalidUploadTokenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof UnsafeStorageKeyError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  return new NextResponse(null, { status: 200 });
}
