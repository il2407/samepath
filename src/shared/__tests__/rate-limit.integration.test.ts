import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { prisma } from "@/shared/db";
import { postgresRateLimit } from "@/shared/rate-limit";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("postgresRateLimit", () => {
  it("allows up to the limit within a window, then blocks", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await postgresRateLimit("t:key", 3, 60_000));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
  });

  it("keeps separate counters per key", async () => {
    await postgresRateLimit("t:a", 1, 60_000);
    expect((await postgresRateLimit("t:a", 1, 60_000)).allowed).toBe(false);
    expect((await postgresRateLimit("t:b", 1, 60_000)).allowed).toBe(true);
  });

  it("starts a fresh window once the previous one has elapsed", async () => {
    await postgresRateLimit("t:reset", 1, 60_000);
    await prisma.rateLimitBucket.update({ where: { key: "t:reset" }, data: { resetAt: new Date(Date.now() - 1000) } });

    const result = await postgresRateLimit("t:reset", 1, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("does not reset a window that is still open", async () => {
    await postgresRateLimit("t:open", 1, 60_000);
    const before = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: "t:open" } });
    await postgresRateLimit("t:open", 1, 60_000);
    const after = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: "t:open" } });
    expect(after.resetAt.getTime()).toBe(before.resetAt.getTime());
    expect(after.count).toBe(2);
  });
});
