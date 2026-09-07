import { timingSafeEqual } from "node:crypto";

/**
 * Pure, DB-free, framework-free authorization check for the scheduler route
 * (src/app/api/jobs/matching/route.ts) — deliberately split out of the
 * route itself so it can be exhaustively unit tested with plain Headers
 * objects and no Next.js/DB machinery, matching this codebase's "pure logic
 * files (no DB, no framework import) — fully unit-testable" convention
 * (see README.md's Architecture section).
 */

/** Reads the caller-supplied secret from either an `Authorization: Bearer
 * <secret>` header or a plain `x-job-scheduler-secret` header — whichever
 * the calling scheduler can set more easily. */
export function extractProvidedSecret(headers: Headers): string | null {
  const authHeader = headers.get("authorization");
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) return bearerMatch[1];
  return headers.get("x-job-scheduler-secret");
}

/** Constant-time comparison so a shared secret can't be brute-forced via
 * response-time differences on a partial match. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * True only when `configuredSecret` is non-empty AND the request supplied a
 * matching secret via either supported header. An empty configuredSecret
 * (JOB_SCHEDULER_SECRET's unset default) always returns false — the route
 * fails closed, never open, when nobody has configured it yet.
 */
export function isAuthorizedRequest(headers: Headers, configuredSecret: string): boolean {
  if (!configuredSecret) return false;

  const providedSecret = extractProvidedSecret(headers);
  if (!providedSecret) return false;

  return safeEqual(providedSecret, configuredSecret);
}
