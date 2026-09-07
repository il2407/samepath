import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { prisma } from "@/shared/db";

const sent: { to: string; text: string }[] = [];
vi.mock("@/modules/notifications/mailer", () => ({
  getMailer: () => ({
    send: async (message: { to: string; text: string }) => {
      sent.push(message);
    },
  }),
}));

const {
  registerWithPassword,
  loginWithPassword,
  confirmEmail,
  requestPasswordReset,
  resetPassword,
  findOrCreateUserFromGoogle,
  getPostAuthRedirectPath,
} = await import("@/modules/auth/service");

function extractToken(text: string): string {
  const match = text.match(/token=([\w-]+)/);
  if (!match) throw new Error(`no token found in email body:\n${text}`);
  return match[1];
}

beforeEach(async () => {
  await resetTestDatabase();
  sent.length = 0;
});

describe("registerWithPassword", () => {
  it("creates a user + EMAIL identity and sends a confirmation email, unverified until confirmed", async () => {
    const result = await registerWithPassword("alice@example.com", "correct horse battery");
    if (!result.ok) throw new Error("expected ok");
    expect(sent).toHaveLength(1);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.emailVerifiedAt).toBeNull();

    const identity = await prisma.authIdentity.findUniqueOrThrow({
      where: { provider_providerAccountId: { provider: "EMAIL", providerAccountId: "alice@example.com" } },
    });
    expect(identity.passwordHash).not.toBeNull();
    expect(identity.passwordHash).not.toContain("correct horse battery");
  });

  it("rejects registering an email that's already taken", async () => {
    await registerWithPassword("bob@example.com", "correct horse battery");
    const second = await registerWithPassword("bob@example.com", "a different password");
    expect(second).toEqual({ ok: false, reason: "email_taken" });
  });
});

describe("loginWithPassword", () => {
  it("logs in with the correct password", async () => {
    const registered = await registerWithPassword("carol@example.com", "correct horse battery");
    if (!registered.ok) throw new Error("expected ok");

    const result = await loginWithPassword("carol@example.com", "correct horse battery", "127.0.0.1");
    expect(result).toEqual({ ok: true, userId: registered.userId });
  });

  it("rejects the wrong password with a generic reason", async () => {
    await registerWithPassword("dave@example.com", "correct horse battery");
    const result = await loginWithPassword("dave@example.com", "wrong password", "127.0.0.1");
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("rejects an unknown email with the same generic reason (no enumeration)", async () => {
    const result = await loginWithPassword("ghost@example.com", "anything", "127.0.0.1");
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("rejects a Google-only account (no password set) with the same generic reason", async () => {
    const google = await findOrCreateUserFromGoogle({
      sub: "google-sub-erin",
      email: "erin@example.com",
      emailVerified: true,
      name: "Erin",
    });
    if (!google.ok) throw new Error("expected ok");

    const result = await loginWithPassword("erin@example.com", "anything", "127.0.0.1");
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("rejects a suspended account", async () => {
    const registered = await registerWithPassword("frank@example.com", "correct horse battery");
    if (!registered.ok) throw new Error("expected ok");
    await prisma.user.update({ where: { id: registered.userId }, data: { status: "SUSPENDED" } });

    const result = await loginWithPassword("frank@example.com", "correct horse battery", "127.0.0.1");
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });
});

describe("confirmEmail", () => {
  it("verifies via the emailed token and cannot be reused", async () => {
    const registered = await registerWithPassword("grace@example.com", "correct horse battery");
    if (!registered.ok) throw new Error("expected ok");
    const token = extractToken(sent[0].text);

    const result = await confirmEmail(token);
    expect(result).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: registered.userId } });
    expect(user.emailVerifiedAt).not.toBeNull();

    const second = await confirmEmail(token);
    expect(second).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("rejects an unknown token", async () => {
    const result = await confirmEmail("not-a-real-token");
    expect(result).toEqual({ ok: false, reason: "invalid_or_expired" });
  });
});

describe("requestPasswordReset + resetPassword", () => {
  it("resets the password via the emailed token and cannot reuse it", async () => {
    const registered = await registerWithPassword("henry@example.com", "old password here");
    if (!registered.ok) throw new Error("expected ok");
    sent.length = 0;

    await requestPasswordReset("henry@example.com", "127.0.0.1");
    expect(sent).toHaveLength(1);
    const token = extractToken(sent[0].text);

    const result = await resetPassword(token, "new password here");
    expect(result).toEqual({ ok: true, userId: registered.userId });

    const oldLogin = await loginWithPassword("henry@example.com", "old password here", "127.0.0.1");
    expect(oldLogin.ok).toBe(false);
    const newLogin = await loginWithPassword("henry@example.com", "new password here", "127.0.0.1");
    expect(newLogin).toEqual({ ok: true, userId: registered.userId });

    const second = await resetPassword(token, "yet another password");
    expect(second).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("sends nothing for an unregistered email but still resolves (no enumeration)", async () => {
    await requestPasswordReset("ghost@example.com", "127.0.0.1");
    expect(sent).toHaveLength(0);
  });

  it("lets a Google-only account set a password for the first time", async () => {
    const google = await findOrCreateUserFromGoogle({
      sub: "google-sub-ivy",
      email: "ivy@example.com",
      emailVerified: true,
      name: "Ivy",
    });
    if (!google.ok) throw new Error("expected ok");

    await requestPasswordReset("ivy@example.com", "127.0.0.1");
    const token = extractToken(sent[0].text);
    const result = await resetPassword(token, "brand new password");
    expect(result).toEqual({ ok: true, userId: google.userId });

    const login = await loginWithPassword("ivy@example.com", "brand new password", "127.0.0.1");
    expect(login).toEqual({ ok: true, userId: google.userId });
  });
});

describe("findOrCreateUserFromGoogle", () => {
  it("creates a new, already-verified user on first sign-in", async () => {
    const result = await findOrCreateUserFromGoogle({
      sub: "google-sub-jack",
      email: "jack@example.com",
      emailVerified: true,
      name: "Jack",
    });
    if (!result.ok) throw new Error("expected ok");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.email).toBe("jack@example.com");
    expect(user.emailVerifiedAt).not.toBeNull();

    const identity = await prisma.authIdentity.findUniqueOrThrow({
      where: { provider_providerAccountId: { provider: "GOOGLE", providerAccountId: "google-sub-jack" } },
    });
    expect(identity.userId).toBe(result.userId);
  });

  it("returns the same user on a repeat sign-in", async () => {
    const first = await findOrCreateUserFromGoogle({
      sub: "google-sub-kate",
      email: "kate@example.com",
      emailVerified: true,
      name: "Kate",
    });
    if (!first.ok) throw new Error("expected ok");

    const second = await findOrCreateUserFromGoogle({
      sub: "google-sub-kate",
      email: "kate@example.com",
      emailVerified: true,
      name: "Kate",
    });
    expect(second).toEqual({ ok: true, userId: first.userId });
  });

  it("auto-links to an existing password account with a matching verified email", async () => {
    const registered = await registerWithPassword("leo@example.com", "correct horse battery");
    if (!registered.ok) throw new Error("expected ok");

    const google = await findOrCreateUserFromGoogle({
      sub: "google-sub-leo",
      email: "leo@example.com",
      emailVerified: true,
      name: "Leo",
    });
    expect(google).toEqual({ ok: true, userId: registered.userId });

    // Auto-linking also unblocks matching eligibility even though the
    // confirmation email was never clicked.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: registered.userId } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it("rejects an unverified Google email", async () => {
    const result = await findOrCreateUserFromGoogle({
      sub: "google-sub-mia",
      email: "mia@example.com",
      emailVerified: false,
      name: "Mia",
    });
    expect(result).toEqual({ ok: false, reason: "email_not_verified" });

    const user = await prisma.user.findUnique({ where: { email: "mia@example.com" } });
    expect(user).toBeNull();
  });

  it("rejects a suspended account's Google sign-in", async () => {
    const registered = await registerWithPassword("nina@example.com", "correct horse battery");
    if (!registered.ok) throw new Error("expected ok");
    await prisma.user.update({ where: { id: registered.userId }, data: { status: "SUSPENDED" } });

    const result = await findOrCreateUserFromGoogle({
      sub: "google-sub-nina",
      email: "nina@example.com",
      emailVerified: true,
      name: "Nina",
    });
    expect(result).toEqual({ ok: false, reason: "account_disabled" });
  });
});

describe("getPostAuthRedirectPath", () => {
  it("sends users without a profile to onboarding", async () => {
    const user = await prisma.user.create({ data: { email: "oscar@example.com" } });
    expect(await getPostAuthRedirectPath(user.id)).toBe("/app/onboarding/profile");
  });

  it("sends users with an active profile to the app home", async () => {
    const user = await prisma.user.create({ data: { email: "paula@example.com" } });
    await prisma.professionalProfile.create({ data: { userId: user.id, status: "ACTIVE" } });
    expect(await getPostAuthRedirectPath(user.id)).toBe("/app");
  });
});
