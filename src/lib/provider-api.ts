// Provider base URL registry. Each video/image model declares its
// `provider` tag in its config. Secrets are resolved by the host adapter
// (`HostAdapter.keys.resolveProviderKey`), never read from env here.

export type ProviderId = "kie";

export const KIE_API_BASE_URL = "https://api.kie.ai";

// Backwards-compat shims. Existing image-side code still imports these
// directly assuming Kie. Until that's migrated, keep the originals working.
export const PROVIDER_API_BASE_URL = KIE_API_BASE_URL;

export function buildProviderUrl(path: string): string {
  return `${KIE_API_BASE_URL}${path}`;
}
