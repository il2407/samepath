import { NextRequest, NextResponse } from "next/server";
import { getGoogleMeetClient } from "@/modules/auth/google-meet";
import {
  clearGoogleMeetOAuthStateCookie,
  clearGoogleMeetReturnToCookie,
  getGoogleMeetOAuthStateCookie,
  getGoogleMeetReturnToCookie,
  requireUser,
} from "@/modules/auth/session";
import { upsertGoogleMeetGrant } from "@/modules/connections/service";
import { rateLimit } from "@/shared/rate-limit";
import { env } from "@/shared/env";

/**
 * Completes the incremental-consent flow started at
 * /api/auth/google-meet/start. Unlike the sign-in callback, this never
 * creates a session — it assumes one already exists (the start route
 * required it) and only ever persists a GoogleMeetGrant for the current user.
 */
function returnError(returnTo: string, reason: string) {
  const url = new URL(returnTo, env.APP_URL);
  url.searchParams.set("googleMeetError", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const user = await requireUser();

  const returnTo = (await getGoogleMeetReturnToCookie()) ?? "/app";
  await clearGoogleMeetReturnToCookie();

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = await getGoogleMeetOAuthStateCookie();
  await clearGoogleMeetOAuthStateCookie();

  if (!code || !state || !expectedState || state !== expectedState) {
    return returnError(returnTo, "state");
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  if (ip) {
    const limited = await rateLimit(`auth:google-meet:ip:${ip}`, 20, 60 * 60 * 1000);
    if (!limited.allowed) return returnError(returnTo, "rate_limited");
  }

  const tokens = await getGoogleMeetClient().exchangeCode(code);
  if (!tokens) return returnError(returnTo, "exchange_failed");

  await upsertGoogleMeetGrant(user.id, tokens);
  return NextResponse.redirect(new URL(returnTo, env.APP_URL));
}
