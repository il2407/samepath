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

const { requestVerificationCode, verifyCode, verifyToken, getPostAuthRedirectPath } = await import(
  "@/modules/auth/service"
);

function extractCode(text: string): string {
  const match = text.match(/\n(\d{6})\n/);
  if (!match) throw new Error(`no code found in email body:\n${text}`);
  return match[1];
}

function extractToken(text: string): string {
  const match = text.match(/token=([\w-]+)/);
  if (!match) throw new Error(`no token found in email body:\n${text}`);
  return match[1];
}

beforeEach(async () => {
  await resetTestDatabase();
  sent.length = 0;
});

describe("requestVerificationCode + verifyCode (REGISTER)", () => {
  it("creates a user and lets them verify with the emailed code", async () => {
    const email = "alice@example.com";
    const req = await requestVerificationCode(email, "REGISTER", "127.0.0.1");
    if (!req.ok) throw new Error("expected ok");
    expect(req.verificationId).not.toBeNull();
    expect(sent).toHaveLength(1);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerifiedAt).toBeNull();

    const code = extractCode(sent[0].text);
    const result = await verifyCode(req.verificationId, code);
    expect(result).toEqual({ ok: true, userId: user.id });

    const verifiedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(verifiedUser.emailVerifiedAt).not.toBeNull();

    const identity = await prisma.authIdentity.findUnique({
      where: { provider_providerAccountId: { provider: "EMAIL", providerAccountId: email } },
    });
    expect(identity).not.toBeNull();
  });

  it("rejects a wrong code, increments attempts, and does not consume it", async () => {
    const req = await requestVerificationCode("bob@example.com", "REGISTER", null);
    if (!req.ok) throw new Error("expected ok");

    const result = await verifyCode(req.verificationId, "000000");
    expect(result).toEqual({ ok: false, reason: "invalid_code" });

    const verification = await prisma.emailVerification.findUniqueOrThrow({
      where: { id: req.verificationId! },
    });
    expect(verification.attempts).toBe(1);
    expect(verification.consumedAt).toBeNull();
  });

  it("locks out after too many wrong attempts, even with the right code", async () => {
    const req = await requestVerificationCode("carol@example.com", "REGISTER", null);
    if (!req.ok) throw new Error("expected ok");

    for (let i = 0; i < 5; i++) {
      await verifyCode(req.verificationId, "000000");
    }

    const code = extractCode(sent[0].text);
    const result = await verifyCode(req.verificationId, code);
    expect(result).toEqual({ ok: false, reason: "too_many_attempts" });
  });

  it("rejects an expired code", async () => {
    const req = await requestVerificationCode("dave@example.com", "REGISTER", null);
    if (!req.ok) throw new Error("expected ok");

    await prisma.emailVerification.update({
      where: { id: req.verificationId! },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const code = extractCode(sent[0].text);
    const result = await verifyCode(req.verificationId, code);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("cannot redeem the same code twice", async () => {
    const req = await requestVerificationCode("erin@example.com", "REGISTER", null);
    if (!req.ok) throw new Error("expected ok");

    const code = extractCode(sent[0].text);
    const first = await verifyCode(req.verificationId, code);
    expect(first.ok).toBe(true);

    const second = await verifyCode(req.verificationId, code);
    expect(second).toEqual({ ok: false, reason: "no_pending" });
  });
});

describe("requestVerificationCode (LOGIN) — no account enumeration", () => {
  it("sends nothing for an unregistered email but still reports success", async () => {
    const result = await requestVerificationCode("ghost@example.com", "LOGIN", null);
    expect(result).toEqual({ ok: true, verificationId: null });
    expect(sent).toHaveLength(0);
  });

  it("sends a real code for a registered email", async () => {
    await prisma.user.create({ data: { email: "frank@example.com" } });
    const result = await requestVerificationCode("frank@example.com", "LOGIN", null);
    if (!result.ok) throw new Error("expected ok");
    expect(result.verificationId).not.toBeNull();
    expect(sent).toHaveLength(1);
  });

  it("does not send to a suspended account", async () => {
    await prisma.user.create({ data: { email: "suspended@example.com", status: "SUSPENDED" } });
    const result = await requestVerificationCode("suspended@example.com", "LOGIN", null);
    expect(result).toEqual({ ok: true, verificationId: null });
    expect(sent).toHaveLength(0);
  });
});

describe("verifyToken (magic link)", () => {
  it("verifies via the emailed token and cannot be reused", async () => {
    const req = await requestVerificationCode("grace@example.com", "REGISTER", null);
    if (!req.ok) throw new Error("expected ok");
    const token = extractToken(sent[0].text);

    const result = await verifyToken(token);
    expect(result.ok).toBe(true);

    const second = await verifyToken(token);
    expect(second).toEqual({ ok: false, reason: "invalid_or_expired" });
  });
});

describe("getPostAuthRedirectPath", () => {
  it("sends users without a profile to onboarding", async () => {
    const user = await prisma.user.create({ data: { email: "henry@example.com" } });
    expect(await getPostAuthRedirectPath(user.id)).toBe("/app/onboarding/profile");
  });

  it("sends users with an active profile to the app home", async () => {
    const user = await prisma.user.create({ data: { email: "ivy@example.com" } });
    await prisma.professionalProfile.create({ data: { userId: user.id, status: "ACTIVE" } });
    expect(await getPostAuthRedirectPath(user.id)).toBe("/app");
  });
});
