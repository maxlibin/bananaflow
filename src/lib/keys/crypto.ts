import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export class AppSecretMissingError extends Error {
  constructor() {
    super("APP_SECRET is not set. Generate one with `openssl rand -hex 32` and add it to .env.");
    this.name = "AppSecretMissingError";
  }
}

// The 32-byte AES key is derived from APP_SECRET so operators only manage one
// value. Rotating APP_SECRET invalidates every stored provider key.
function deriveKey(appSecret: string): Buffer {
  return createHash("sha256").update(appSecret).digest();
}

export function encryptSecret(plaintext: string, appSecret: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(appSecret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret, appSecret: string): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(appSecret),
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function requireAppSecret(): string {
  const appSecret = process.env.APP_SECRET;
  if (!appSecret) throw new AppSecretMissingError();
  return appSecret;
}
