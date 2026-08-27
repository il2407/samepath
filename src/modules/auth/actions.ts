"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isValidEmail, normalizeEmail } from "@/modules/auth/validation";
import { requestVerificationCode, verifyCode, getPostAuthRedirectPath } from "@/modules/auth/service";
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

export type RequestCodeState = { ok: boolean; error?: string };

async function requestCode(email: string, purpose: "REGISTER" | "LOGIN"): Promise<RequestCodeState> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { ok: false, error: "כתובת האימייל אינה תקינה" };
  }
  const result = await requestVerificationCode(normalized, purpose, await clientIp());
  if (!result.ok) {
    return { ok: false, error: "יותר מדי בקשות. נסו שוב בעוד כמה דקות" };
  }
  if (result.verificationId) {
    await setPendingVerificationCookie(result.verificationId);
  } else {
    await clearPendingVerificationCookie();
  }
  return { ok: true };
}

export async function requestRegisterCodeAction(email: string): Promise<RequestCodeState> {
  return requestCode(email, "REGISTER");
}

export async function requestLoginCodeAction(email: string): Promise<RequestCodeState> {
  return requestCode(email, "LOGIN");
}

export type SubmitCodeState = { ok: boolean; error?: string };

const errorMessages: Record<string, string> = {
  no_pending: "פג תוקף הבקשה. בקשו קוד חדש",
  expired: "הקוד פג תוקף. בקשו קוד חדש",
  too_many_attempts: "יותר מדי ניסיונות. בקשו קוד חדש",
  invalid_code: "קוד שגוי. נסו שוב",
};

export async function submitVerificationCodeAction(code: string): Promise<SubmitCodeState> {
  const verificationId = await getPendingVerificationId();
  const result = await verifyCode(verificationId, code.trim());
  if (!result.ok) {
    return { ok: false, error: errorMessages[result.reason] ?? "משהו השתבש. נסו שוב" };
  }
  await createSession(result.userId);
  await clearPendingVerificationCookie();
  const redirectPath = await getPostAuthRedirectPath(result.userId);
  redirect(redirectPath);
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}
