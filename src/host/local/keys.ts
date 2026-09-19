import { ProviderKeyMissingError } from "../../lib/host/errors";
import type { EngineDatabase, HostAdapter } from "../../lib/host/types";
import { readProviderKey } from "../../lib/keys/provider-keys";
import { requireAppSecret } from "../../lib/keys/crypto";

const ENV_FALLBACK_BY_PROVIDER = {
  kie: "KIE_SECRET",
} as const;

// Order: the key saved on the Settings page, then the env var, then an
// error whose hint points the user at Settings.
export function createLocalKeys(db: EngineDatabase): HostAdapter["keys"] {
  return {
    async resolveProviderKey(userId, provider) {
      const stored = await readProviderKey(db, userId, provider, requireAppSecret());
      if (stored) return stored;
      const fromEnv = process.env[ENV_FALLBACK_BY_PROVIDER[provider]];
      if (fromEnv) return fromEnv;
      throw new ProviderKeyMissingError(
        provider,
        userId,
        "No Kie.ai API key saved. Add one on the Settings page.",
      );
    },
  };
}
