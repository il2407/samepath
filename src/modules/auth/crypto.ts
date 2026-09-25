import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scryptSync } from "node:crypto";
import { env } from "@/shared/env";

/** Opaque URL-safe token for magic links and session identifiers. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Cryptographically-random numeric code (e.g. "042917") for manual entry, such as email OTPs. */
export function generateNumericCode(digits = 6): string {
  const max = 10 ** digits;
  return randomInt(0, max).toString().padStart(digits, "0");
}

/**
 * One-way hash for values we only ever need to compare, never recover:
 * verification codes, magic-link tokens, session tokens. Not a password
 * hash (no salt/stretching) — these are high-entropy random values or
 * short-lived, attempt-capped codes, not user-chosen secrets.
 */
export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_SALT = "samepath.google-token-encryption.v1";

// Derived once from GOOGLE_TOKEN_ENCRYPTION_KEY rather than reusing
// SESSION_SECRET, which is scoped to session-token hashing — mixing key
// usages across unrelated purposes is poor practice.
let cachedKey: Buffer | null = null;
function encryptionKey(): Buffer {
  if (!cachedKey) {
    cachedKey = scryptSync(env.GOOGLE_TOKEN_ENCRYPTION_KEY, ENCRYPTION_KEY_SALT, 32);
  }
  return cachedKey;
}

/**
 * Reversible encryption for at-rest secrets that must later be decrypted for
 * use (e.g. a Google OAuth refresh token) — unlike hashSecret above, which is
 * one-way and cannot support that. AES-256-GCM with a random 12-byte IV per
 * call; output packs iv, auth tag, and ciphertext together as base64url so a
 * single string column can store it.
 */
export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

export function decryptSecret(packed: string): string {
  const buffer = Buffer.from(packed, "base64url");
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
