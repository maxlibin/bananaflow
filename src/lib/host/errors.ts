import type { ProviderId } from "../provider-api";

export class ProviderKeyMissingError extends Error {
  readonly provider: ProviderId;
  readonly userId: string;
  // Safe to show to the end user, e.g. "Add your Kie.ai API key on the Settings page."
  readonly hint: string;

  constructor(provider: ProviderId, userId: string, hint: string) {
    super(`No API key available for provider "${provider}" (user ${userId}): ${hint}`);
    this.name = "ProviderKeyMissingError";
    this.provider = provider;
    this.userId = userId;
    this.hint = hint;
  }
}
