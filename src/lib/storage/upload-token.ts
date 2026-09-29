import { createHmac, timingSafeEqual } from "node:crypto";

export class InvalidUploadTokenError extends Error {
  constructor(reason: string) {
    super(`Upload refused: ${reason}`);
    this.name = "InvalidUploadTokenError";
  }
}

function signature(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

// Stateless permission to PUT exactly `size` bytes to `key` until `expiresAt` (ms).
export function signUploadToken(secret: string, claim: { key: string; size: number; expiresAt: number }): string {
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${payload}.${signature(secret, payload)}`;
}

export function verifyUploadToken(secret: string, token: string, key: string, size: number, now: number): void {
  const [payload, sent] = token.split(".");
  if (!payload || !sent) throw new InvalidUploadTokenError("malformed token");
  const expected = signature(secret, payload);
  if (sent.length !== expected.length || !timingSafeEqual(Buffer.from(sent), Buffer.from(expected))) {
    throw new InvalidUploadTokenError("bad signature");
  }
  const claim = JSON.parse(Buffer.from(payload, "base64url").toString()) as { key: string; size: number; expiresAt: number };
  if (claim.key !== key) throw new InvalidUploadTokenError(`token is for ${claim.key}, not ${key}`);
  if (claim.size !== size) throw new InvalidUploadTokenError(`token allows ${claim.size} bytes, got ${size}`);
  if (now > claim.expiresAt) throw new InvalidUploadTokenError("token expired");
}
