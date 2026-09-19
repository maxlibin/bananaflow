import { ProviderKeyMissingError } from "../../lib/host/errors";
import type { EngineDatabase, HostAdapter } from "../../lib/host/types";
import { readProviderKey } from "../../lib/keys/provider-keys";
import { requireAppSecret } from "../../lib/keys/crypto";
import { PROVIDERS } from "../../lib/providers/types";

// Order: the key saved on the Settings page, then the provider's env var,
// then an error whose hint points the user at Settings.
export function createLocalKeys(db: EngineDatabase): HostAdapter["keys"] {
  return {
    async resolveProviderKey(userId, provider) {
      const stored = await readProviderKey(db, userId, provider, requireAppSecret());
      if (stored) return stored;
      const info = PROVIDERS[provider];
      const fromEnv = process.env[info.envVarName];
      if (fromEnv) return fromEnv;
      throw new ProviderKeyMissingError(
        provider,
        userId,
        `No ${info.label} API key saved. Add one on the Settings page.`,
      );
    },
  };
}
