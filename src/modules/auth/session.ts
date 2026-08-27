import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { prisma } from "@/shared/db";
import { env } from "@/shared/env";
import { generateToken, hashSecret } from "@/modules/auth/crypto";
import type { User } from "@/generated/prisma/client";

export const SESSION_COOKIE = "samepath_session";
export const PENDING_VERIFICATION_COOKIE = "samepath_pending_verification";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // refresh once <7 days remain

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

async function ipHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  return ip ? createHash("sha256").update(ip).digest("hex") : null;
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const h = await headers();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: h.get("user-agent")?.slice(0, 255),
      ipHash: await ipHash(),
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS / 1000));
}

export interface CurrentSession {
  user: User;
  sessionId: string;
}

/** Validates the session cookie against the database. Never trust the cookie alone. */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSecret(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (session.user.status === "SUSPENDED" || session.user.status === "DELETED") {
    return null;
  }

  const msRemaining = session.expiresAt.getTime() - Date.now();
  const updates: { lastUsedAt: Date; expiresAt?: Date } = { lastUsedAt: new Date() };
  if (msRemaining < SESSION_REFRESH_THRESHOLD_MS) {
    updates.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  }
  await prisma.session.update({ where: { id: session.id }, data: updates });

  return { user: session.user, sessionId: session.id };
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashSecret(token) },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(SESSION_COOKIE);
}

/** Redirects to /login when there is no valid session. Use in every protected layout/page. */
export async function requireUser(): Promise<User> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session.user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/app");
  return user;
}

export async function requireModerator(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") redirect("/app");
  return user;
}

/** Redirects away from auth pages (/login, /register) when already signed in. */
export async function redirectIfAuthenticated(): Promise<void> {
  const session = await getCurrentSession();
  if (session) redirect("/app");
}

export async function setPendingVerificationCookie(verificationId: string): Promise<void> {
  const jar = await cookies();
  jar.set(PENDING_VERIFICATION_COOKIE, verificationId, cookieOptions(15 * 60));
}

export async function getPendingVerificationId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PENDING_VERIFICATION_COOKIE)?.value ?? null;
}

export async function clearPendingVerificationCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(PENDING_VERIFICATION_COOKIE);
}
