import { NextRequest, NextResponse } from "next/server";
import { confirmEmail, getPostAuthRedirectPath } from "@/modules/auth/service";
import { getCurrentSession } from "@/modules/auth/session";
import { env } from "@/shared/env";

/** Confirms the email address behind a REGISTER-purpose EmailVerification token, sent right after password registration. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?confirmError=1", env.APP_URL));
  }

  const result = await confirmEmail(token);
  if (!result.ok) {
    return NextResponse.redirect(new URL("/login?confirmError=1", env.APP_URL));
  }

  // Usually already logged in (session created at registration); fall back
  // for the case this link is opened in a different browser/session.
  const session = await getCurrentSession();
  const redirectPath = session ? await getPostAuthRedirectPath(session.user.id) : "/login";
  return NextResponse.redirect(new URL(redirectPath, env.APP_URL));
}
