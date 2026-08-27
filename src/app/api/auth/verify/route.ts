import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getPostAuthRedirectPath } from "@/modules/auth/service";
import { createSession, clearPendingVerificationCookie } from "@/modules/auth/session";
import { env } from "@/shared/env";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?linkError=1", env.APP_URL));
  }

  const result = await verifyToken(token);
  if (!result.ok) {
    return NextResponse.redirect(new URL("/login?linkError=1", env.APP_URL));
  }

  await createSession(result.userId);
  await clearPendingVerificationCookie();

  const redirectPath = await getPostAuthRedirectPath(result.userId);
  return NextResponse.redirect(new URL(redirectPath, env.APP_URL));
}
