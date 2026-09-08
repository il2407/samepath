import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/modules/auth/crypto";
import { getGoogleMeetClient } from "@/modules/auth/google-meet";
import { requireUser, setGoogleMeetOAuthStateCookie, setGoogleMeetReturnToCookie } from "@/modules/auth/session";
import { env } from "@/shared/env";

/**
 * Kicks off the incremental-consent flow for the Google Meet API
 * (meetings.space.created scope) — separate from /api/auth/google/start,
 * which only ever requests sign-in scopes. Gated by requireUser(), unlike
 * the sign-in start route: this is "connect an already-authenticated
 * account to Google Meet," not "sign in with Google."
 */
export async function GET(request: NextRequest) {
  await requireUser();

  const returnTo = request.nextUrl.searchParams.get("returnTo");
  // Only ever accept an internal, root-relative path — never redirect off-app.
  await setGoogleMeetReturnToCookie(returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/app");

  const state = generateToken();
  await setGoogleMeetOAuthStateCookie(state);
  return NextResponse.redirect(new URL(getGoogleMeetClient().getAuthorizationUrl(state), env.APP_URL));
}
