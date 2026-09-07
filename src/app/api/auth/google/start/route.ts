import { NextResponse } from "next/server";
import { generateToken } from "@/modules/auth/crypto";
import { getGoogleOAuthClient } from "@/modules/auth/google-oauth";
import { setOAuthStateCookie } from "@/modules/auth/session";
import { env } from "@/shared/env";

/** Kicks off Google sign-in — works identically for register and login (findOrCreateUserFromGoogle decides which happened). */
export async function GET() {
  const state = generateToken();
  await setOAuthStateCookie(state);
  // new URL(x, base) resolves relative or absolute x the same way — the fake
  // adapter returns a relative same-app path, the real one an absolute Google URL.
  return NextResponse.redirect(new URL(getGoogleOAuthClient().getAuthorizationUrl(state), env.APP_URL));
}
