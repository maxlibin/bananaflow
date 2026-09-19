import { and, eq } from "drizzle-orm";
import { providerKeys } from "../../db/schema";
import type { EngineDatabase } from "../host/types";
import type { Provider, ProviderId, ProviderKeyCheck } from "../providers/types";
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

export type { ProviderKeyCheck };

// Calls a cheap authenticated endpoint on the provider so the user learns
// immediately whether a pasted key works.
export async function checkProviderKey(
  provider: Provider,
  plaintext: string,
): Promise<ProviderKeyCheck> {
  return provider.checkKey(plaintext);
}
