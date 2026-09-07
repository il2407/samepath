import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";

/**
 * DB-backed — do NOT run this file yourself while WS1 is also using the
 * shared samepath_test database. Written for coordinator-run verification.
 *
 * The analytics page's entire authorization logic is one line —
 * `await requireAdmin()` at the top of src/app/admin/analytics/page.tsx —
 * which is deliberately *stricter* than the /admin layout's
 * `requireModerator()` gate (see the page's own comment and this
 * workstream's brief: a moderator must NOT reach this page just because
 * they can reach the rest of /admin). Rather than stand up a full Next.js
 * request/render harness to prove that one line behaves correctly, this
 * file exercises `requireAdmin`/`requireModerator` (auth/session.ts) —
 * read-only for this workstream, only imported here — directly against
 * real DB-backed sessions for every role, which is exactly the code path
 * the page's one line runs.
 *
 * next/headers has no request scope outside an actual Next.js request
 * lifecycle, so cookies()/headers() are mocked with a tiny in-memory jar
 * implementing just the get/set/delete surface session.ts actually calls —
 * enough for createSession()/getCurrentSession()'s real, unmodified code to
 * run against it. next/navigation's redirect() normally never returns (it
 * throws a framework-internal signal); it's mocked here to throw a plain,
 * assertable Error instead.
 */

function makeCookieJar() {
  const store = new Map<string, string>();
  return {
    get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  };
}

let jar = makeCookieJar();

vi.mock("next/headers", () => ({
  cookies: async () => jar,
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

const { createSession, requireAdmin, requireModerator } = await import("@/modules/auth/session");

beforeEach(async () => {
  await resetTestDatabase();
  jar = makeCookieJar();
});

describe("the analytics page's authorization gate (requireAdmin, via auth/session.ts)", () => {
  it("rejects an unauthenticated request — redirects to /login, for both requireAdmin and requireModerator", async () => {
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login");
    await expect(requireModerator()).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects a plain MEMBER — redirects to /app for both requireAdmin and requireModerator", async () => {
    const { user } = await createTestUser();
    await createSession(user.id);

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/app");
    await expect(requireModerator()).rejects.toThrow("REDIRECT:/app");
  });

  it("rejects a MODERATOR from requireAdmin specifically (redirects to /app) while requireModerator still lets them through — proves the page's stricter gate actually excludes moderators", async () => {
    const { user } = await createTestUser();
    await prisma.user.update({ where: { id: user.id }, data: { role: "MODERATOR" } });
    await createSession(user.id);

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/app");
    const resolved = await requireModerator();
    expect(resolved.id).toBe(user.id);
  });

  it("lets an actual ADMIN through requireAdmin (and requireModerator)", async () => {
    const { user } = await createTestUser();
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    await createSession(user.id);

    const viaAdmin = await requireAdmin();
    const viaModerator = await requireModerator();

    expect(viaAdmin.id).toBe(user.id);
    expect(viaModerator.id).toBe(user.id);
  });

  it("rejects a SUSPENDED admin — session lookup itself must fail closed regardless of role", async () => {
    const { user } = await createTestUser();
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    await createSession(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login");
  });
});
