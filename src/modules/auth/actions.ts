"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isValidEmail, isValidPassword, normalizeEmail } from "@/modules/auth/validation";
import {
  getPostAuthRedirectPath,
  loginWithPassword,
  registerWithPassword,
  requestPasswordReset,
  resetPassword,
} from "@/modules/auth/service";
import { createSession, destroyCurrentSession } from "@/modules/auth/session";

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
  if (!result.ok) return { ok: false, error: "כתובת האימייל הזו כבר רשומה. נסו להתחבר במקום" };

  await createSession(result.userId);
  redirect(await getPostAuthRedirectPath(result.userId));
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
      error: result.reason === "rate_limited" ? "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות" : "אימייל או סיסמה שגויים",
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
