"use server";

import { revalidatePath } from "next/cache";
import { host } from "../../host";
import { getProvider } from "../../lib/providers";
import { requireAppSecret } from "../../lib/keys/crypto";
import {
  checkProviderKey,
  deleteProviderKey,
  listProviderKeys,
  saveProviderKey,
  type StoredProviderKey,
} from "../../lib/keys/provider-keys";
import type { ProviderId } from "../../lib/providers/types";

export type SaveKeyResult =
  | { success: true }
  | { success: false; error: string };

export async function getProviderKeys(): Promise<StoredProviderKey[]> {
  const userId = await host.auth.getUserId();
  if (!userId) return [];
  return listProviderKeys(host.db, userId, requireAppSecret());
}

export async function saveKey(provider: ProviderId, plaintext: string): Promise<SaveKeyResult> {
  const userId = await host.auth.getUserId();
  if (!userId) return { success: false, error: "Not signed in" };
  const trimmed = plaintext.trim();
  if (trimmed.length === 0) return { success: false, error: "Paste a key first" };
  const check = await checkProviderKey(getProvider(host, provider), trimmed);
  if (!check.ok) {
    return {
      success: false,
      error: `The provider rejected this key (${check.status}): ${check.body}`,
    };
  }
  await saveProviderKey(host.db, userId, provider, trimmed, requireAppSecret());
  revalidatePath("/settings");
  return { success: true };
}

export async function clearKey(provider: ProviderId): Promise<SaveKeyResult> {
  const userId = await host.auth.getUserId();
  if (!userId) return { success: false, error: "Not signed in" };
  await deleteProviderKey(host.db, userId, provider);
  revalidatePath("/settings");
  return { success: true };
}

export async function testKey(provider: ProviderId, plaintext: string): Promise<SaveKeyResult> {
  const check = await checkProviderKey(getProvider(host, provider), plaintext.trim());
  if (check.ok) return { success: true };
  return {
    success: false,
    error: `The provider rejected this key (${check.status}): ${check.body}`,
  };
}
