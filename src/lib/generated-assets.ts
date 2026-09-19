import type { GeneratedAsset } from "./providers/types";
import { extensionForContentType } from "./providers/types";

export type MaterializedAsset = { bytes: Buffer; contentType: string; ext: string };

// Downloads URL assets so every asset ends up as bytes ready for storage.
// Providers that already returned bytes pass through untouched.
export async function materializeAssets(
  assets: GeneratedAsset[],
  signal: AbortSignal,
): Promise<MaterializedAsset[]> {
  const out: MaterializedAsset[] = [];
  for (const asset of assets) {
    if (asset.kind === "bytes") {
      out.push({ bytes: asset.bytes, contentType: asset.contentType, ext: asset.ext });
      continue;
    }
    const res = await fetch(asset.url, { signal });
    if (!res.ok) {
      throw new Error(`Failed to download generated asset ${asset.url}: HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    out.push({
      bytes: Buffer.from(await res.arrayBuffer()),
      contentType,
      ext: extensionForContentType(contentType),
    });
  }
  return out;
}
