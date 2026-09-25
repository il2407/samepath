"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isValidEmail, isValidPassword, normalizeEmail } from "@/modules/auth/validation";
import {
  confirmEmailCode,
  getPostAuthRedirectPath,
  loginWithPassword,
  registerWithPassword,
  requestPasswordReset,
  resendEmailConfirmation,
  resetPassword,
} from "@/modules/auth/service";
import {
  clearPendingVerificationCookie,
  createSession,
  destroyCurrentSession,
  getPendingVerificationId,
  setPendingVerificationCookie,
} from "@/modules/auth/session";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export type ActionState = { ok: boolean; error?: string };

export async function registerWithPasswordAction(input: { email: string; password: string }): Promise<ActionState> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, error: "כתובת האימייל אינה תקינה" };
  if (!isValidPassword(input.password)) return { ok: false, error: "הסיסמה חייבת להכיל לפחות 8 תווים" };

  const result = await registerWithPassword(email, input.password);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "account_blocked"
          ? "לא ניתן להירשם עם כתובת האימייל הזו"
          : "כתובת האימייל הזו כבר רשומה. נסו להתחבר במקום",
    };
  }

  await setPendingVerificationCookie(result.verificationId);
  redirect("/verify-email");
}

export async function verifyEmailCodeAction(code: string): Promise<ActionState> {
  const verificationId = await getPendingVerificationId();
  if (!verificationId) return { ok: false, error: "תוקף האימות פג. נסו להירשם מחדש" };

  const result = await confirmEmailCode(verificationId, code);
  if (!result.ok) {
    return {
      ok: false,
      error: result.reason === "too_many_attempts" ? "יותר מדי ניסיונות שגויים. בקשו קוד חדש" : "הקוד שגוי. נסו שוב",
    };
  }

  await clearPendingVerificationCookie();
  await createSession(result.userId);
  redirect(await getPostAuthRedirectPath(result.userId));
}

export async function resendVerificationCodeAction(): Promise<ActionState> {
  const verificationId = await getPendingVerificationId();
  if (!verificationId) return { ok: false, error: "תוקף האימות פג. נסו להירשם מחדש" };

  const result = await resendEmailConfirmation(verificationId);
  if (!result) return { ok: false, error: "לא ניתן לשלוח קוד חדש כרגע. נסו שוב בעוד כמה דקות" };

  await setPendingVerificationCookie(result.verificationId);
  return { ok: true };
}

export async function loginWithPasswordAction(input: { email: string; password: string }): Promise<ActionState> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email) || !input.password) {
    return { ok: false, error: "אימייל או סיסמה שגויים" };
  }

  const result = await loginWithPassword(email, input.password, await clientIp());
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "rate_limited"
          ? "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות"
          : result.reason === "account_blocked"
            ? "החשבון הזה נחסם ואין אליו גישה"
            : "אימייל או סיסמה שגויים",
    };
  }

  await createSession(result.userId);
  redirect(await getPostAuthRedirectPath(result.userId));
}

export async function requestPasswordResetAction(email: string): Promise<ActionState> {
  const normalized = normalizeEmail(email);
  if (isValidEmail(normalized)) {
    await requestPasswordReset(normalized, await clientIp());
  }
  // Always a generic success, whether or not the email exists — no enumeration.
  return { ok: true };
}

export async function resetPasswordAction(input: { token: string; password: string }): Promise<ActionState> {
  if (!isValidPassword(input.password)) return { ok: false, error: "הסיסמה חייבת להכיל לפחות 8 תווים" };

  const result = await resetPassword(input.token, input.password);
  if (!result.ok) return { ok: false, error: "הקישור פג תוקף או שכבר נעשה בו שימוש. בקשו קישור חדש" };

  await createSession(result.userId);
  redirect(await getPostAuthRedirectPath(result.userId));
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}
