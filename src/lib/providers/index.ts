import { googleProvider } from "./google";
import { kieProvider } from "./kie";
import { openaiProvider } from "./openai";
import type { Provider, ProviderId } from "./types";

const PROVIDERS_BY_ID: Record<ProviderId, Provider> = {
  openai: openaiProvider,
  google: googleProvider,
  kie: kieProvider,
};

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS_BY_ID[id];
}
