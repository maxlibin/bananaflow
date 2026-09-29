import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { InvalidUploadTokenError, signUploadToken, verifyUploadToken } from "../src/lib/storage/upload-token.ts";
import { createLocalDiskStorage } from "../src/lib/storage/local-disk.ts";

const SECRET = "test-secret-not-for-production";

test("an upload token only fits its key, size and lifetime", () => {
  const token = signUploadToken(SECRET, { key: "local/sequences/b/x.mp4", size: 10, expiresAt: 2_000 });
  verifyUploadToken(SECRET, token, "local/sequences/b/x.mp4", 10, 1_000);
  for (const [key, size, now] of [["local/sequences/b/y.mp4", 10, 1_000], ["local/sequences/b/x.mp4", 11, 1_000], ["local/sequences/b/x.mp4", 10, 3_000]] as const) {
    assert.throws(() => verifyUploadToken(SECRET, token, key, size, now), InvalidUploadTokenError);
  }
  assert.throws(() => verifyUploadToken("other", token, "local/sequences/b/x.mp4", 10, 1_000), InvalidUploadTokenError);
});

test("local disk hands out an app upload URL and reports stored sizes", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "bf-upload-"));
  const storage = createLocalDiskStorage({ rootDir, appOrigin: "http://localhost:3100", publicPath: "/uploads", uploadSecret: SECRET });
  const upload = await storage.createUpload({ key: "local/sequences/b/x.mp4", contentType: "video/mp4", size: 3 });
  assert.equal(upload.method, "PUT");
  assert.match(upload.uploadUrl, /^\/api\/uploads\/local\/sequences\/b\/x\.mp4\?token=/);
  assert.equal(await storage.getAssetSize("local/sequences/b/x.mp4"), null);
  await storage.uploadAsset({ key: "local/sequences/b/x.mp4", body: Buffer.from("abc"), contentType: "video/mp4" });
  assert.equal(await storage.getAssetSize("local/sequences/b/x.mp4"), 3);
  assert.equal(storage.assetUrl("local/sequences/b/x.mp4"), "/uploads/local/sequences/b/x.mp4");
});
