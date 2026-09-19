import type { HostAdapter } from "../host/types";
import { UnknownProviderError, type Provider, type ProviderId } from "./types";

export function findProvider(host: HostAdapter, id: ProviderId): Provider | null {
  return host.providers.list.find((provider) => provider.info.id === id) ?? null;
}

export function getProvider(host: HostAdapter, id: ProviderId): Provider {
  const provider = findProvider(host, id);
  if (!provider) throw new UnknownProviderError(id);
  return provider;
}

export function isProviderEnabled(host: HostAdapter, id: ProviderId): boolean {
  return findProvider(host, id) !== null;
}
