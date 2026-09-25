import { prisma } from "@/shared/db";
import { env } from "@/shared/env";

/**
 * Fixed-window rate limiter with two adapters (RATE_LIMIT_ADAPTER):
 * - `memory`: per-process Map — fine for local dev and tests, but each
 *   serverless instance keeps its own counts, so it under-limits in prod.
 * - `postgres`: one atomic upsert per check against `rate_limit_buckets`,
 *   shared by every instance. Use this on Vercel/any multi-instance deploy.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    windows.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

// Periodic cleanup so long-running dev/test processes don't leak memory.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  },
  10 * 60 * 1000,
).unref?.();

/** Roughly 1 in PRUNE_EVERY checks also deletes expired buckets — keeps the
 * table small without a scheduled job (see "No background job queue"). */
const PRUNE_EVERY = 200;

export async function postgresRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  // Pass "now" in rather than using SQL now(): resetAt is a timezone-less
  // column written in UTC, so comparing against the session-TZ now() could skew.
  const now = new Date();
  const newResetAt = new Date(now.getTime() + windowMs);
  // Single statement so concurrent requests on different instances can't
  // both read a stale count: start a fresh window if the old one elapsed,
  // otherwise increment in place.
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO rate_limit_buckets ("key", "count", "resetAt")
    VALUES (${key}, 1, ${newResetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN rate_limit_buckets."resetAt" <= ${now} THEN 1 ELSE rate_limit_buckets."count" + 1 END,
      "resetAt" = CASE WHEN rate_limit_buckets."resetAt" <= ${now} THEN EXCLUDED."resetAt" ELSE rate_limit_buckets."resetAt" END
    RETURNING "count", "resetAt"`;

  if (Math.random() * PRUNE_EVERY < 1) {
    await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lte: now } } });
  }

  const { count, resetAt } = rows[0];
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: resetAt.getTime() };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  return env.RATE_LIMIT_ADAPTER === "postgres"
    ? postgresRateLimit(key, limit, windowMs)
    : memoryRateLimit(key, limit, windowMs);
}
