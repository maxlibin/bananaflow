export class CronSecretMissingError extends Error {
  constructor() {
    super("CRON_SECRET is not set. Cron routes refuse every request until it is configured.");
    this.name = "CronSecretMissingError";
  }
}

export function requireCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new CronSecretMissingError();
  return secret;
}
