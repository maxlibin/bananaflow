import type { HostAdapter } from "./host/types";

// Reference images are stored as app-relative URLs when local-disk storage
// is in use. A provider can only download them through a public origin, so
// prefix them with the host's public base URL when one is configured.
// Without one they are passed through unchanged and the provider reports
// the failure.
export function toProviderAssetUrl(host: HostAdapter, url: string): string {
  if (!url.startsWith("/")) return url;
  const base = host.callbacks.publicBaseUrl();
  if (base === null) return url;
  return `${base}${url}`;
}
