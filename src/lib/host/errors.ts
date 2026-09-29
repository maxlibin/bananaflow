import type { ProviderId } from "../providers/types";

export class ProviderKeyMissingError extends Error {
  readonly provider: ProviderId;
  readonly userId: string;
  // Safe to show to the end user, e.g. "Add your OpenAI API key on the Settings page."
  readonly hint: string;

  constructor(provider: ProviderId, userId: string, hint: string) {
    super(`No API key available for provider "${provider}" (user ${userId}): ${hint}`);
    this.name = "ProviderKeyMissingError";
    this.provider = provider;
    this.userId = userId;
    this.hint = hint;
  }
}

// A storage backend that cannot perform the operation in this deployment
// (e.g. direct uploads without an object store). Actions return its message.
export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageUnavailableError";
  }
}
