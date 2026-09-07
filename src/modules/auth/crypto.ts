import { createHash, randomBytes } from "node:crypto";

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
