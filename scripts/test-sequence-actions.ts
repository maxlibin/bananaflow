import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db } from "../src/db/index.ts";
import { boards, media } from "../src/db/schema.ts";
import { host as localHost } from "../src/host/index.ts";
import type { HostAdapter, LimitDecision } from "../src/lib/host/types.ts";
import { createLocalDiskStorage } from "../src/lib/storage/local-disk.ts";
import { createExportUpload, saveSequenceExport } from "../src/lib/actions/sequence.ts";

const USER = `seq-test-${createId()}`;
const QUOTA_BYTES = 1000;
let boardId = "";
let storage: ReturnType<typeof createLocalDiskStorage>;
let host: HostAdapter;

before(async () => {
  storage = createLocalDiskStorage({
    rootDir: await mkdtemp(path.join(tmpdir(), "bf-seq-")),
    appOrigin: "http://localhost:3100",
    publicPath: "/uploads",
    uploadSecret: "test-secret-not-for-production",
  });
  host = {
    ...localHost,
    auth: { async getUserId() { return USER; } },
    storage,
    limits: {
      ...localHost.limits,
      async canStore(_userId: string, deltaBytes: number): Promise<LimitDecision> {
        if (deltaBytes <= QUOTA_BYTES) return { ok: true };
        return {
          ok: false,
          status: 403,
          code: "storage_limit",
          message: "Storage limit reached",
          feature: "STORAGE_BYTES",
          upgradeRequired: true,
          plan: null,
          retryAfterMs: null,
        };
      },
    },
  };
  const [board] = await db.insert(boards).values({ title: "sequence actions test", userId: USER }).returning();
  boardId = board.id;
});

after(async () => {
  await db.delete(media).where(eq(media.userId, USER));
  await db.delete(boards).where(eq(boards.userId, USER));
});

test("createExportUpload issues an upload under the user's sequence prefix", async () => {
  const result = await createExportUpload(host, { boardId, nodeId: "seq", size: 3 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.value.key, new RegExp(`^${USER}/sequences/${boardId}/[a-z0-9]+\\.mp4$`));
});

test("createExportUpload returns the storage denial when the quota is exceeded", async () => {
  const result = await createExportUpload(host, { boardId, nodeId: "seq", size: 5000 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.denial?.status, 403);
});

test("saveSequenceExport rejects foreign keys and wrong sizes before writing media", async () => {
  await storage.uploadAsset({ key: `other/sequences/${boardId}/x.mp4`, body: Buffer.from("abc"), contentType: "video/mp4" });
  const foreign = await saveSequenceExport(host, { boardId, nodeId: "seq", key: `other/sequences/${boardId}/x.mp4`, size: 3, durationSeconds: 1, width: 1080, height: 1920 });
  assert.equal(foreign.ok, false);
  const key = `${USER}/sequences/${boardId}/y.mp4`;
  await storage.uploadAsset({ key, body: Buffer.from("abcd"), contentType: "video/mp4" });
  const wrongSize = await saveSequenceExport(host, { boardId, nodeId: "seq", key, size: 3, durationSeconds: 1, width: 1080, height: 1920 });
  assert.deepEqual(wrongSize, { ok: false, error: `Uploaded file is 4 bytes; expected 3`, denial: null });
  const rows = await db.select().from(media).where(eq(media.boardId, boardId));
  assert.equal(rows.length, 0);
});

test("saveSequenceExport records the export as board media", async () => {
  const key = `${USER}/sequences/${boardId}/z.mp4`;
  await storage.uploadAsset({ key, body: Buffer.from("abc"), contentType: "video/mp4" });
  const saved = await saveSequenceExport(host, { boardId, nodeId: "seq", key, size: 3, durationSeconds: 6, width: 1080, height: 1920 });
  assert.equal(saved.ok, true);
  const [row] = await db.select().from(media).where(eq(media.boardId, boardId));
  assert.equal(row.type, "VIDEO");
  assert.equal(row.nodeId, "seq");
  assert.equal(row.fileSize, 3);
});
