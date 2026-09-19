import { test } from "node:test";
import assert from "node:assert/strict";

import { decryptSecret, encryptSecret } from "../src/lib/keys/crypto.ts";

const APP_SECRET = "test-app-secret-not-for-production";

test("encryptSecret round-trips through decryptSecret", () => {
  const encrypted = encryptSecret("sk-kie-1234567890", APP_SECRET);
  assert.notEqual(encrypted.ciphertext, "sk-kie-1234567890");
  assert.equal(decryptSecret(encrypted, APP_SECRET), "sk-kie-1234567890");
});

test("each encryption uses a fresh IV", () => {
  const a = encryptSecret("same-key", APP_SECRET);
  const b = encryptSecret("same-key", APP_SECRET);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test("decrypting with a different APP_SECRET fails loudly", () => {
  const encrypted = encryptSecret("sk-kie-1234567890", APP_SECRET);
  assert.throws(() => decryptSecret(encrypted, "another-secret"));
});
