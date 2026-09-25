import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/modules/notifications/mailer", () => ({
  getMailer: () => ({
    send: async (message: { to: string; subject: string; text: string }) => {
      sent.push(message);
    },
  }),
}));

const { approveUser, blockUser, unblockUser, listUsersForAdmin, countUsersByFilter } = await import(
  "@/modules/admin/users"
);
const { registerWithPassword, loginWithPassword } = await import("@/modules/auth/service");

beforeEach(async () => {
  await resetTestDatabase();
  sent.length = 0;
});

describe("approveUser", () => {
  it("activates a pending account, notifies in-app and emails the user", async () => {
    const { user } = await createTestUser({ userStatus: "PENDING_APPROVAL" });

    expect(await approveUser(user.id)).toEqual({ ok: true });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.status).toBe("ACTIVE");
    const notifications = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notifications.map((n) => n.type)).toEqual(["ACCOUNT_APPROVED"]);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(user.email);
  });

  it("refuses an account that isn't pending", async () => {
    const { user } = await createTestUser({ userStatus: "ACTIVE" });
    expect(await approveUser(user.id)).toEqual({ ok: false, reason: "invalid_state" });
    expect(sent).toHaveLength(0);
  });

  it("never acts on staff accounts", async () => {
    const { user } = await createTestUser({ userStatus: "PENDING_APPROVAL" });
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    expect(await approveUser(user.id)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("blockUser / unblockUser", () => {
  it("blocks: revokes sessions, then the email can neither log in nor re-register", async () => {
    const registered = await registerWithPassword("blocked@example.com", "correct horse battery");
    if (!registered.ok) throw new Error("expected ok");
    await prisma.session.create({
      data: { userId: registered.userId, tokenHash: "hash-1", expiresAt: new Date(Date.now() + 86_400_000) },
    });

    expect(await blockUser(registered.userId)).toEqual({ ok: true });

    const sessions = await prisma.session.findMany({ where: { userId: registered.userId } });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(await loginWithPassword("blocked@example.com", "correct horse battery", "127.0.0.1")).toEqual({
      ok: false,
      reason: "account_blocked",
    });
    expect(await registerWithPassword("blocked@example.com", "another password 123")).toEqual({
      ok: false,
      reason: "account_blocked",
    });
  });

  it("unblocks back to ACTIVE, and only from SUSPENDED", async () => {
    const { user } = await createTestUser({ userStatus: "SUSPENDED" });
    expect(await unblockUser(user.id)).toEqual({ ok: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("ACTIVE");
    expect(await unblockUser(user.id)).toEqual({ ok: false, reason: "invalid_state" });
  });
});

describe("listUsersForAdmin / countUsersByFilter", () => {
  it("filters by status bucket, searches by email, and excludes staff", async () => {
    await createTestUser({ email: "pending@example.com", userStatus: "PENDING_APPROVAL" });
    await createTestUser({ email: "active@example.com", userStatus: "ACTIVE" });
    await createTestUser({ email: "blocked@example.com", userStatus: "SUSPENDED" });
    const { user: staff } = await createTestUser({ email: "staff@example.com", userStatus: "PENDING_APPROVAL" });
    await prisma.user.update({ where: { id: staff.id }, data: { role: "MODERATOR" } });

    expect((await listUsersForAdmin("PENDING")).map((u) => u.email)).toEqual(["pending@example.com"]);
    expect((await listUsersForAdmin("BLOCKED")).map((u) => u.email)).toEqual(["blocked@example.com"]);
    expect((await listUsersForAdmin("ALL", "ACTIVE@")).map((u) => u.email)).toEqual(["active@example.com"]);
    expect(await countUsersByFilter()).toEqual({ PENDING: 1, ACTIVE: 1, BLOCKED: 1, ALL: 3 });
  });
});
