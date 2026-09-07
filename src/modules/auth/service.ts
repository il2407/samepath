import "server-only";
import { prisma } from "@/shared/db";
import { rateLimit } from "@/shared/rate-limit";
import { generateToken, hashSecret } from "@/modules/auth/crypto";
import { hashPassword, verifyPassword } from "@/modules/auth/password";
import { verificationEmail } from "@/modules/auth/email-templates";
import { getMailer } from "@/modules/notifications/mailer";
import type { GoogleProfile } from "@/modules/auth/google-oauth";

// Pure DB + mail logic, deliberately free of Next.js request-scoped APIs
// (cookies/redirect) so it can be exercised directly in integration tests.
// The cookie/session/redirect glue lives in actions.ts.

const CONFIRMATION_TTL_MS = 15 * 60 * 1000;

function isDisabled(status: string): boolean {
  return status === "SUSPENDED" || status === "DELETED";
}

// --- Password registration / login ------------------------------------------

export type RegisterResult = { ok: true; userId: string } | { ok: false; reason: "email_taken" };

export async function registerWithPassword(email: string, password: string): Promise<RegisterResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, reason: "email_taken" };

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email } });
    await tx.authIdentity.create({
      data: { userId: created.id, provider: "EMAIL", providerAccountId: email, passwordHash },
    });
    return created;
  });

  await sendEmailConfirmation(user.id);
  return { ok: true, userId: user.id };
}

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_credentials" | "rate_limited" };

/**
 * Always the same generic "invalid_credentials" reason for unknown email,
 * missing password (a Google-only account), wrong password, or a
 * suspended/deleted account — a failed attempt never reveals which of those
 * it was.
 */
export async function loginWithPassword(
  email: string,
  password: string,
  requestIp: string | null,
): Promise<LoginResult> {
  const perEmail = rateLimit(`auth:password:email:${email}`, 5, 60 * 60 * 1000);
  if (!perEmail.allowed) return { ok: false, reason: "rate_limited" };
  if (requestIp) {
    const perIp = rateLimit(`auth:password:ip:${requestIp}`, 20, 60 * 60 * 1000);
    if (!perIp.allowed) return { ok: false, reason: "rate_limited" };
  }

  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider: "EMAIL", providerAccountId: email } },
    include: { user: true },
  });
  if (!identity || !identity.passwordHash || isDisabled(identity.user.status)) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const valid = await verifyPassword(password, identity.passwordHash);
  if (!valid) return { ok: false, reason: "invalid_credentials" };

  await prisma.user.update({ where: { id: identity.userId }, data: { lastLoginAt: new Date() } });
  return { ok: true, userId: identity.userId };
}

// --- Email confirmation -------------------------------------------------------

export async function sendEmailConfirmation(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const token = generateToken();
  await prisma.emailVerification.create({
    data: {
      userId,
      purpose: "REGISTER",
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
    },
  });
  const message = verificationEmail({ token, purpose: "REGISTER" });
  await getMailer().send({ to: user.email, ...message });
}

export type ConfirmEmailResult = { ok: true } | { ok: false; reason: "invalid_or_expired" };

export async function confirmEmail(token: string): Promise<ConfirmEmailResult> {
  const verification = await prisma.emailVerification.findUnique({ where: { tokenHash: hashSecret(token) } });
  if (
    !verification ||
    verification.purpose !== "REGISTER" ||
    verification.consumedAt ||
    verification.expiresAt < new Date()
  ) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  await prisma.$transaction([
    prisma.emailVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: verification.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  return { ok: true };
}

// --- Password reset -------------------------------------------------------------

/** No-enumeration: always resolves regardless of whether the email is registered — the caller shows one generic message either way. */
export async function requestPasswordReset(email: string, requestIp: string | null): Promise<void> {
  const perEmail = rateLimit(`auth:password-reset:email:${email}`, 5, 60 * 60 * 1000);
  if (!perEmail.allowed) return;
  if (requestIp) {
    const perIp = rateLimit(`auth:password-reset:ip:${requestIp}`, 20, 60 * 60 * 1000);
    if (!perIp.allowed) return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || isDisabled(user.status)) return;

  const token = generateToken();
  await prisma.emailVerification.create({
    data: {
      userId: user.id,
      purpose: "PASSWORD_RESET",
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
    },
  });
  const message = verificationEmail({ token, purpose: "PASSWORD_RESET" });
  await getMailer().send({ to: user.email, ...message });
}

export type ResetPasswordResult = { ok: true; userId: string } | { ok: false; reason: "invalid_or_expired" };

/** Upserts (not just updates) the EMAIL identity — this doubles as "set a password" for a Google-only account with none yet. */
export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
  const verification = await prisma.emailVerification.findUnique({ where: { tokenHash: hashSecret(token) } });
  if (
    !verification ||
    verification.purpose !== "PASSWORD_RESET" ||
    verification.consumedAt ||
    verification.expiresAt < new Date()
  ) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: verification.userId } });
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.emailVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } }),
    prisma.authIdentity.upsert({
      where: { provider_providerAccountId: { provider: "EMAIL", providerAccountId: user.email } },
      update: { passwordHash },
      create: { userId: user.id, provider: "EMAIL", providerAccountId: user.email, passwordHash },
    }),
  ]);
  return { ok: true, userId: verification.userId };
}

// --- Google OAuth ----------------------------------------------------------------

export type GoogleAuthResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "email_not_verified" | "account_disabled" };

/**
 * Account-linking policy: an existing GOOGLE identity always wins (returning
 * user); otherwise a Google-verified email matching an existing User
 * auto-links a new GOOGLE identity to it — safe, since Google itself just
 * proved ownership of that exact email; otherwise a brand-new User is
 * created, already email-verified. Never trusts an unverified Google email.
 */
export async function findOrCreateUserFromGoogle(profile: GoogleProfile): Promise<GoogleAuthResult> {
  if (!profile.emailVerified) return { ok: false, reason: "email_not_verified" };

  const existingIdentity = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider: "GOOGLE", providerAccountId: profile.sub } },
    include: { user: true },
  });
  if (existingIdentity) {
    if (isDisabled(existingIdentity.user.status)) return { ok: false, reason: "account_disabled" };
    await prisma.user.update({ where: { id: existingIdentity.userId }, data: { lastLoginAt: new Date() } });
    return { ok: true, userId: existingIdentity.userId };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: profile.email } });
  if (existingUser) {
    if (isDisabled(existingUser.status)) return { ok: false, reason: "account_disabled" };
    await prisma.$transaction([
      prisma.authIdentity.create({
        data: { userId: existingUser.id, provider: "GOOGLE", providerAccountId: profile.sub },
      }),
      prisma.user.update({
        where: { id: existingUser.id },
        data: { emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(), lastLoginAt: new Date() },
      }),
    ]);
    return { ok: true, userId: existingUser.id };
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: profile.email, emailVerifiedAt: new Date(), lastLoginAt: new Date() },
    });
    await tx.authIdentity.create({ data: { userId: user.id, provider: "GOOGLE", providerAccountId: profile.sub } });
    return user;
  });
  return { ok: true, userId: created.id };
}

/** Where to send a user right after they authenticate. Onboarding-aware once that module exists. */
export async function getPostAuthRedirectPath(userId: string): Promise<string> {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  if (!profile || profile.status === "DRAFT" || profile.status === "INCOMPLETE") {
    return "/app/onboarding/profile";
  }
  return "/app";
}
