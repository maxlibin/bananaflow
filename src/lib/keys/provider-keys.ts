import { and, eq } from "drizzle-orm";
import { providerKeys } from "../../db/schema";
import type { EngineDatabase } from "../host/types";
import { KIE_API_BASE_URL, type ProviderId } from "../provider-api";
import { decryptSecret, encryptSecret } from "./crypto";

export type StoredProviderKey = {
  provider: ProviderId;
  // Last four characters, for display. The full key never leaves the server.
  lastFour: string;
  updatedAt: Date;
};

export async function listProviderKeys(
  db: EngineDatabase,
  userId: string,
  appSecret: string,
): Promise<StoredProviderKey[]> {
  const rows = await db.select().from(providerKeys).where(eq(providerKeys.userId, userId));
  return rows.map((row) => ({
    provider: row.provider as ProviderId,
    lastFour: decryptSecret(row, appSecret).slice(-4),
    updatedAt: row.updatedAt,
  }));
}

export async function readProviderKey(
  db: EngineDatabase,
  userId: string,
  provider: ProviderId,
  appSecret: string,
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(providerKeys)
    .where(and(eq(providerKeys.userId, userId), eq(providerKeys.provider, provider)))
    .limit(1);
  if (!row) return null;
  return decryptSecret(row, appSecret);
}

export async function saveProviderKey(
  db: EngineDatabase,
  userId: string,
  provider: ProviderId,
  plaintext: string,
  appSecret: string,
): Promise<void> {
  const encrypted = encryptSecret(plaintext, appSecret);
  await db
    .insert(providerKeys)
    .values({ userId, provider, ...encrypted })
    .onConflictDoUpdate({
      target: [providerKeys.userId, providerKeys.provider],
      set: { ...encrypted, updatedAt: new Date() },
    });
}

export async function deleteProviderKey(
  db: EngineDatabase,
  userId: string,
  provider: ProviderId,
): Promise<void> {
  await db
    .delete(providerKeys)
    .where(and(eq(providerKeys.userId, userId), eq(providerKeys.provider, provider)));
}

export type ProviderKeyCheck =
  | { ok: true }
  // `status` is the provider's own error code when it returns one in the
  // body (Kie answers HTTP 200 with {code: 401}), otherwise the HTTP status.
  | { ok: false; status: number; body: string };

// Calls a cheap authenticated endpoint so the user learns immediately
// whether a pasted key works. The response body is returned verbatim on
// failure because Kie's error text is the most useful thing to show.
export async function checkProviderKey(
  provider: ProviderId,
  plaintext: string,
): Promise<ProviderKeyCheck> {
  const endpoint: Record<ProviderId, string> = {
    kie: `${KIE_API_BASE_URL}/api/v1/chat/credit`,
  };
  const res = await fetch(endpoint[provider], {
    headers: { Authorization: `Bearer ${plaintext}` },
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: body.slice(0, 500) };
  let parsed: { code?: number; msg?: string };
  try {
    parsed = JSON.parse(body) as { code?: number; msg?: string };
  } catch {
    return { ok: false, status: res.status, body: body.slice(0, 500) };
  }
  if (parsed.code !== undefined && parsed.code !== 200) {
    return { ok: false, status: parsed.code, body: parsed.msg ?? body.slice(0, 500) };
  }
  return { ok: true };
}
