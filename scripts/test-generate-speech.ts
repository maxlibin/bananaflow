import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db } from "../src/db/index.ts";
import { boards, media } from "../src/db/schema.ts";
import { host as localHost } from "../src/host/index.ts";
import type { HostAdapter } from "../src/lib/host/types.ts";
import type { Provider } from "../src/lib/providers/types.ts";
import { createGenerateSpeechRoute } from "../src/lib/routes/generate-speech.ts";

const USER = `speech-test-${createId()}`;
let boardId = "";
let othersBoardId = "";
let providerCalls = 0;

const host: HostAdapter = {
  ...localHost,
  auth: { async getUserId() { return USER; } },
  providers: {
    list: localHost.providers.list.map((provider): Provider => ({
      ...provider,
      async createSpeech(input) {
        providerCalls += 1;
        return provider.createSpeech(input);
      },
    })),
  },
};
const { POST } = createGenerateSpeechRoute(host);
const post = (body: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/generate-speech", { method: "POST", body: JSON.stringify(body) }));

before(async () => {
  const [mine] = await db.insert(boards).values({ title: "speech test", userId: USER }).returning();
  const [theirs] = await db.insert(boards).values({ title: "not mine", userId: `${USER}-other` }).returning();
  boardId = mine.id;
  othersBoardId = theirs.id;
});
after(async () => {
  await db.delete(media).where(eq(media.userId, USER));
  await db.delete(boards).where(eq(boards.userId, USER));
  await db.delete(boards).where(eq(boards.userId, `${USER}-other`));
});

test("speech for someone else's board is refused before any provider call", async () => {
  const response = await post({ boardId: othersBoardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "coral", text: "Hi" });
  assert.equal(response.status, 404);
  assert.equal(providerCalls, 0);
});

test("invalid input is refused with the reason", async () => {
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ boardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "coral", text: "   " }, /empty/],
    [{ boardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "coral", text: "x".repeat(601) }, /600/],
    [{ boardId, nodeId: "seq", model: "nope", voiceId: "coral", text: "Hi" }, /Unknown speech model/],
    [{ boardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "nope", text: "Hi" }, /Unknown voice/],
  ];
  for (const [body, message] of cases) {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.match(((await response.json()) as { error: string }).error, message);
  }
  assert.equal(providerCalls, 0);
});

test("a line becomes a stored, measured audio media row", { skip: process.env.OPENAI_API_KEY ? false : "no OpenAI key in .env" }, async () => {
  const response = await post({ boardId, nodeId: "seq", model: "openai/gpt-4o-mini-tts", voiceId: "coral", text: "Meet the stand." });
  const body = (await response.json()) as { ok: boolean; value: { url: string; mediaId: string; seconds: number } };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(body.value.seconds > 0.3 && body.value.seconds < 8);
  const [row] = await db.select().from(media).where(eq(media.id, body.value.mediaId));
  assert.equal(row.type, "AUDIO");
  assert.equal(row.prompt, "Meet the stand.");
  assert.ok(row.fileSize && row.fileSize > 1000);
});
