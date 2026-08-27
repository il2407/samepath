import { createHash, randomBytes, randomInt } from "node:crypto";

/** 6-digit numeric code, e.g. "042917". Zero-padded so it always sorts the same visual width. */
export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Opaque URL-safe token for magic links and session identifiers. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
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
