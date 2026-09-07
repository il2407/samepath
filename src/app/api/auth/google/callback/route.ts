import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthClient } from "@/modules/auth/google-oauth";
import { findOrCreateUserFromGoogle, getPostAuthRedirectPath } from "@/modules/auth/service";
import { clearOAuthStateCookie, createSession, getOAuthStateCookie } from "@/modules/auth/session";
import { rateLimit } from "@/shared/rate-limit";
import { env } from "@/shared/env";

function loginError(reason: string) {
  return NextResponse.redirect(new URL(`/login?googleError=${reason}`, env.APP_URL));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = await getOAuthStateCookie();
  await clearOAuthStateCookie();

  if (!code || !state || !expectedState || state !== expectedState) {
    return loginError("state");
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  if (ip) {
    const limited = rateLimit(`auth:google:ip:${ip}`, 20, 60 * 60 * 1000);
    if (!limited.allowed) return loginError("rate_limited");
  }

  const profile = await getGoogleOAuthClient().exchangeCode(code);
  if (!profile) return loginError("exchange_failed");

  const result = await findOrCreateUserFromGoogle(profile);
  if (!result.ok) return loginError(result.reason);

  await createSession(result.userId);
  return NextResponse.redirect(new URL(await getPostAuthRedirectPath(result.userId), env.APP_URL));
}
