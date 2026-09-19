import type { HostAdapter } from "./host/types";
import type { ReferenceImage } from "./providers/types";
import { toProviderAssetUrl } from "./asset-urls";

// Builds provider-ready reference images from stored asset URLs. URL-taking
// providers get a public URL; byte-taking providers fetch the bytes lazily
// through the host so app-relative uploads work without a public origin.
export function buildReferenceImages(host: HostAdapter, urls: string[]): ReferenceImage[] {
  return urls.map((url) => ({
    publicUrl: toProviderAssetUrl(host, url),
    fetchBytes: async () => {
      const absolute = host.storage.resolveAssetUrl(url);
      const res = await fetch(absolute);
      if (!res.ok) {
        throw new Error(`Failed to fetch reference image ${absolute}: HTTP ${res.status}`);
      }
      return {
        bytes: Buffer.from(await res.arrayBuffer()),
        contentType: res.headers.get("content-type") ?? "image/png",
      };
    },
  }));
}
