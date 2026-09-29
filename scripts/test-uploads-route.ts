import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";

import { UPLOADS_DIR } from "../src/host/local/storage.ts";
import { GET } from "../src/app/uploads/[...path]/route.ts";

// Browsers load video metadata and seek with Range requests; without 206
// responses a local MP4 never becomes playable.
const DIR = "test-range";
const BYTES = Buffer.from("0123456789");

before(async () => {
  await mkdir(path.join(UPLOADS_DIR, DIR), { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, DIR, "clip.mp4"), BYTES);
});
after(async () => {
  await rm(path.join(UPLOADS_DIR, DIR), { recursive: true, force: true });
});

function get(range: string | null) {
  const headers = range ? { range } : undefined;
  const request = new NextRequest(`http://localhost/uploads/${DIR}/clip.mp4`, { headers });
  return GET(request, { params: Promise.resolve({ path: [DIR, "clip.mp4"] }) });
}

test("a full request advertises byte ranges", async () => {
  const response = await get(null);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), "0123456789");
});

test("a range request returns 206 with just those bytes", async () => {
  const response = await get("bytes=2-5");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 2-5/10");
  assert.equal(response.headers.get("content-length"), "4");
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), "2345");
});

test("an open-ended range runs to the end of the file", async () => {
  const response = await get("bytes=7-");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 7-9/10");
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), "789");
});

test("a range past the end is refused with 416", async () => {
  const response = await get("bytes=20-30");
  assert.equal(response.status, 416);
  assert.equal(response.headers.get("content-range"), "bytes */10");
});
