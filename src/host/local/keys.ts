import { ProviderKeyMissingError } from "../../lib/host/errors";
import type { EngineDatabase, HostAdapter } from "../../lib/host/types";
import { readProviderKey } from "../../lib/keys/provider-keys";
import { requireAppSecret } from "../../lib/keys/crypto";
import { UnknownProviderError, type Provider } from "../../lib/providers/types";

// Order: the key saved on the Settings page, then the provider's env var,
// then an error whose hint points the user at Settings.
export function createLocalKeys(db: EngineDatabase, providers: Provider[]): HostAdapter["keys"] {
  return {
    async resolveProviderKey(userId, providerId) {
      const provider = providers.find((candidate) => candidate.info.id === providerId);
      if (!provider) throw new UnknownProviderError(providerId);
      const stored = await readProviderKey(db, userId, providerId, requireAppSecret());
      if (stored) return stored;
      const fromEnv = process.env[provider.info.envVarName];
      if (fromEnv) return fromEnv;
      throw new ProviderKeyMissingError(
        providerId,
        userId,
        `No ${provider.info.label} API key saved. Add one on the Settings page.`,
      );
    },
  };
}
