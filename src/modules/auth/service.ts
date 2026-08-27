import "server-only";
import { prisma } from "@/shared/db";
import { rateLimit } from "@/shared/rate-limit";
import { generateToken, generateVerificationCode, hashSecret } from "@/modules/auth/crypto";
import { verificationEmail } from "@/modules/auth/email-templates";
import { getMailer } from "@/modules/notifications/mailer";
import type { VerificationPurpose } from "@/generated/prisma/client";

// Pure DB + mail logic, deliberately free of Next.js request-scoped APIs
// (cookies/redirect) so it can be exercised directly in integration tests.
// The cookie/session/redirect glue lives in actions.ts.

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

export type RequestCodeResult =
  | { ok: true; verificationId: string | null }
  | { ok: false; reason: "rate_limited" };

/**
 * Always resolves the same shape regardless of whether the account exists
 * (for LOGIN) — the caller shows one generic message either way, so an
 * attacker can't use response differences to enumerate registered emails.
 * `verificationId: null` means "pretend we sent it" (unknown LOGIN email).
 */
export async function requestVerificationCode(
  email: string,
  purpose: Extract<VerificationPurpose, "REGISTER" | "LOGIN">,
  requestIp: string | null,
): Promise<RequestCodeResult> {
  const perEmail = rateLimit(`auth:code:email:${email}`, 5, 60 * 60 * 1000);
  if (!perEmail.allowed) return { ok: false, reason: "rate_limited" };
  if (requestIp) {
    const perIp = rateLimit(`auth:code:ip:${requestIp}`, 20, 60 * 60 * 1000);
    if (!perIp.allowed) return { ok: false, reason: "rate_limited" };
  }

  let userId: string;
  if (purpose === "REGISTER") {
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });
    userId = user.id;
  } else {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status === "SUSPENDED" || user.status === "DELETED") {
      return { ok: true, verificationId: null };
    }
    userId = user.id;
  }

  const code = generateVerificationCode();
  const token = generateToken();
  const verification = await prisma.emailVerification.create({
    data: {
      userId,
      purpose,
      codeHash: hashSecret(code),
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      requestIp: requestIp ?? undefined,
    },
  });

  const message = verificationEmail({ code, token, purpose });
  await getMailer().send({ to: email, ...message });

  return { ok: true, verificationId: verification.id };
}

export type VerifyCodeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "no_pending" | "expired" | "too_many_attempts" | "invalid_code" };

export async function verifyCode(
  verificationId: string | null,
  code: string,
): Promise<VerifyCodeResult> {
  if (!verificationId) return { ok: false, reason: "no_pending" };

  const verification = await prisma.emailVerification.findUnique({ where: { id: verificationId } });
  if (!verification || verification.consumedAt) return { ok: false, reason: "no_pending" };
  if (verification.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (verification.attempts >= MAX_VERIFY_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  if (verification.codeHash !== hashSecret(code)) {
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "invalid_code" };
  }

  await completeVerification(verification.id, verification.userId);
  return { ok: true, userId: verification.userId };
}

export type VerifyTokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_or_expired" };

export async function verifyToken(token: string): Promise<VerifyTokenResult> {
  const verification = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashSecret(token) },
  });
  if (!verification || verification.consumedAt || verification.expiresAt < new Date()) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  await completeVerification(verification.id, verification.userId);
  return { ok: true, userId: verification.userId };
}

async function completeVerification(verificationId: string, userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.emailVerification.update({
      where: { id: verificationId },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date(), lastLoginAt: new Date() },
    }),
  ]);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.authIdentity.upsert({
    where: { provider_providerAccountId: { provider: "EMAIL", providerAccountId: user.email } },
    update: {},
    create: { userId, provider: "EMAIL", providerAccountId: user.email },
  });
}

/** Where to send a user right after they authenticate. Onboarding-aware once that module exists. */
export async function getPostAuthRedirectPath(userId: string): Promise<string> {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  if (!profile || profile.status === "DRAFT" || profile.status === "INCOMPLETE") {
    return "/app/onboarding/profile";
  }
  return "/app";
}
