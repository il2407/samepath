import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/db";
import { rateLimit } from "@/shared/rate-limit";
import { generateNumericCode, generateToken, hashSecret } from "@/modules/auth/crypto";
import { hashPassword, verifyPassword } from "@/modules/auth/password";
import { verificationEmail } from "@/modules/auth/email-templates";
import { getMailer } from "@/modules/notifications/mailer";
import type { GoogleProfile } from "@/modules/auth/google-oauth";
import { grantFreeTrialAccessPass } from "@/modules/access-passes/service";

// Pure DB + mail logic, deliberately free of Next.js request-scoped APIs
// (cookies/redirect) so it can be exercised directly in integration tests.
// The cookie/session/redirect glue lives in actions.ts.

const CONFIRMATION_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function isDisabled(status: string): boolean {
  return status === "SUSPENDED" || status === "DELETED";
}

// --- Password registration / login ------------------------------------------

export type RegisterResult =
  | { ok: true; userId: string; verificationId: string }
  | { ok: false; reason: "email_taken" | "account_blocked" };

/**
 * Registration itself only ever collects an email + password — no
 * ProfessionalProfile is created here. Both a fresh password user and a
 * fresh Google sign-in (findOrCreateUserFromGoogle) land with no
 * ProfessionalProfile row at all, and go straight into onboarding's
 * resume-upload-first step 1 (see getPostAuthRedirectPath below).
 */
export async function registerWithPassword(email: string, password: string): Promise<RegisterResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.status === "SUSPENDED") return { ok: false, reason: "account_blocked" };
  if (existing) return { ok: false, reason: "email_taken" };

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    // New accounts wait for an admin to approve them (admin/users.ts) before
    // they become match-eligible — the privacy engine treats
    // PENDING_APPROVAL as ineligible.
    const created = await tx.user.create({ data: { email, status: "PENDING_APPROVAL" } });
    await tx.authIdentity.create({
      data: { userId: created.id, provider: "EMAIL", providerAccountId: email, passwordHash },
    });
    await grantFreeTrialAccessPass(created.id, 30, tx);
    return created;
  });

  const { verificationId } = await sendEmailConfirmation(user.id);
  return { ok: true, userId: user.id, verificationId };
}

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_credentials" | "rate_limited" | "account_blocked" };

/**
 * Always the same generic "invalid_credentials" reason for unknown email,
 * missing password (a Google-only account), wrong password, or a
 * deleted account — a failed attempt never reveals which of those it was.
 * An admin-blocked (SUSPENDED) account gets "account_blocked", but only after
 * the correct password, so it reveals nothing to someone guessing.
 */
export async function loginWithPassword(
  email: string,
  password: string,
  requestIp: string | null,
): Promise<LoginResult> {
  const perEmail = await rateLimit(`auth:password:email:${email}`, 5, 60 * 60 * 1000);
  if (!perEmail.allowed) return { ok: false, reason: "rate_limited" };
  if (requestIp) {
    const perIp = await rateLimit(`auth:password:ip:${requestIp}`, 20, 60 * 60 * 1000);
    if (!perIp.allowed) return { ok: false, reason: "rate_limited" };
  }

  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider: "EMAIL", providerAccountId: email } },
    include: { user: true },
  });
  if (!identity || !identity.passwordHash || identity.user.status === "DELETED") {
    return { ok: false, reason: "invalid_credentials" };
  }

  const valid = await verifyPassword(password, identity.passwordHash);
  if (!valid) return { ok: false, reason: "invalid_credentials" };
  if (isDisabled(identity.user.status)) return { ok: false, reason: "account_blocked" };

  await prisma.user.update({ where: { id: identity.userId }, data: { lastLoginAt: new Date() } });
  return { ok: true, userId: identity.userId };
}

// --- Email confirmation -------------------------------------------------------
//
// REGISTER uses a 6-digit code, manually typed in by the user (not a link) —
// the row is keyed by `id` (handed back to the caller, then round-tripped via
// the pending-verification cookie) rather than by the code itself, since a
// 6-digit space is far too small to be a safe global lookup key on its own.
// `tokenHash` stores hash(`${id}:${code}`) so the column can stay a single
// unique string shared with PASSWORD_RESET's link-token rows below.

export type SendConfirmationResult = { verificationId: string };

export async function sendEmailConfirmation(userId: string): Promise<SendConfirmationResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const id = randomUUID();
  const code = generateNumericCode();
  await prisma.emailVerification.create({
    data: {
      id,
      userId,
      purpose: "REGISTER",
      tokenHash: hashSecret(`${id}:${code}`),
      expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
    },
  });
  const message = verificationEmail({ code, purpose: "REGISTER" });
  await getMailer().send({ to: user.email, ...message });
  return { verificationId: id };
}

/** Rate-limited resend: issues a fresh code (and row) for the same pending registration. */
export async function resendEmailConfirmation(verificationId: string): Promise<SendConfirmationResult | null> {
  const verification = await prisma.emailVerification.findUnique({ where: { id: verificationId } });
  if (!verification || verification.purpose !== "REGISTER" || verification.consumedAt) return null;

  const limited = !(await rateLimit(`auth:resend-code:${verification.userId}`, 5, 60 * 60 * 1000)).allowed;
  if (limited) return null;

  return sendEmailConfirmation(verification.userId);
}

export type ConfirmEmailCodeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "wrong_code" | "too_many_attempts" | "invalid_or_expired" };

export async function confirmEmailCode(verificationId: string, code: string): Promise<ConfirmEmailCodeResult> {
  const verification = await prisma.emailVerification.findUnique({ where: { id: verificationId } });
  if (
    !verification ||
    verification.purpose !== "REGISTER" ||
    verification.consumedAt ||
    verification.expiresAt < new Date()
  ) {
    return { ok: false, reason: "invalid_or_expired" };
  }
  if (verification.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }

  const matches = verification.tokenHash === hashSecret(`${verification.id}:${code}`);
  if (!matches) {
    await prisma.emailVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: "wrong_code" };
  }

  await prisma.$transaction([
    prisma.emailVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: verification.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  return { ok: true, userId: verification.userId };
}

// --- Password reset -------------------------------------------------------------

/** No-enumeration: always resolves regardless of whether the email is registered — the caller shows one generic message either way. */
export async function requestPasswordReset(email: string, requestIp: string | null): Promise<void> {
  const perEmail = await rateLimit(`auth:password-reset:email:${email}`, 5, 60 * 60 * 1000);
  if (!perEmail.allowed) return;
  if (requestIp) {
    const perIp = await rateLimit(`auth:password-reset:ip:${requestIp}`, 20, 60 * 60 * 1000);
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
      data: {
        email: profile.email,
        status: "PENDING_APPROVAL",
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });
    await tx.authIdentity.create({ data: { userId: user.id, provider: "GOOGLE", providerAccountId: profile.sub } });
    await grantFreeTrialAccessPass(user.id, 30, tx);
    return user;
  });
  return { ok: true, userId: created.id };
}

/**
 * Where to send a user right after they authenticate. A missing profile row
 * means a brand-new sign-in — Google (findOrCreateUserFromGoogle never
 * creates one) or password (registerWithPassword doesn't either) — so they
 * go straight into onboarding's resume-upload-first step 1.
 */
export async function getPostAuthRedirectPath(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user && user.role !== "MEMBER") return "/admin";
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  if (!profile) return "/app/onboarding/welcome";
  if (profile.status === "DRAFT" || profile.status === "INCOMPLETE") {
    return "/app/onboarding/profile";
  }
  return "/app";
}
