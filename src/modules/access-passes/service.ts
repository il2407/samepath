import "server-only";
import { prisma } from "@/shared/db";
import { computeExpiryDate, daysRemaining, needsExpiryReminder } from "@/modules/access-passes/timing";
import { getMailer } from "@/modules/notifications/mailer";
import type { ActivationEventType } from "@/generated/prisma/client";

const REMINDER_THRESHOLD_DAYS = 7;

async function expireStalePassesForUser(userId: string): Promise<void> {
  const stale = await prisma.accessPass.findMany({
    where: { userId, status: "ACTIVE", expiresAt: { lte: new Date() } },
    select: { id: true },
  });
  if (stale.length === 0) return;
  await prisma.accessPass.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { status: "EXPIRED" } });
  await prisma.accessPassEvent.createMany({ data: stale.map((s) => ({ accessPassId: s.id, type: "EXPIRED" as const })) });
}

export interface AccessStatus {
  hasActivePass: boolean;
  expiresAt: Date | null;
  daysRemaining: number | null;
  pendingPass: boolean;
}

export async function getAccessStatus(userId: string): Promise<AccessStatus> {
  await expireStalePassesForUser(userId);

  const activePass = await prisma.accessPass.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { activatedAt: "desc" } });
  const pending = await prisma.accessPass.findFirst({ where: { userId, status: "PENDING_ACTIVATION" } });

  return {
    hasActivePass: !!activePass,
    expiresAt: activePass?.expiresAt ?? null,
    daysRemaining: daysRemaining(activePass?.expiresAt ?? null),
    pendingPass: !!pending,
  };
}

/**
 * The real access gate for the matching/groups state machines. Called at
 * the exact moment of a "meaningful activation event" (first mutual
 * connection, first group join). An existing active pass passes trivially;
 * a paid-but-not-yet-started pass starts its clock right now; with neither,
 * the gate fails and the event cannot complete until the user purchases.
 */
export async function checkAndActivateAccessGate(userId: string, eventType: ActivationEventType): Promise<boolean> {
  await expireStalePassesForUser(userId);

  const activePass = await prisma.accessPass.findFirst({ where: { userId, status: "ACTIVE" } });
  if (activePass) return true;

  const pendingPass = await prisma.accessPass.findFirst({
    where: { userId, status: "PENDING_ACTIVATION" },
    orderBy: { createdAt: "asc" },
  });
  if (!pendingPass) return false;

  const activatedAt = new Date();
  const expiresAt = computeExpiryDate(activatedAt, pendingPass.durationDays);

  await prisma.$transaction([
    prisma.accessPass.update({
      where: { id: pendingPass.id },
      data: { status: "ACTIVE", activationEventType: eventType, activatedAt, expiresAt },
    }),
    prisma.accessPassEvent.create({
      data: { accessPassId: pendingPass.id, type: "ACTIVATED", metadata: { eventType } },
    }),
  ]);

  return true;
}

export async function createPendingAccessPass(
  userId: string,
  paymentId: string,
  productConfigId: string,
  durationDays: number,
) {
  const accessPass = await prisma.accessPass.create({
    data: { userId, paymentId, productConfigId, status: "PENDING_ACTIVATION", durationDays },
  });
  await prisma.accessPassEvent.create({ data: { accessPassId: accessPass.id, type: "CREATED" } });
  return accessPass;
}

/**
 * Extends (or, if none is active, grants a short free) access without a new
 * purchase — for when the other party in a connection never responded or
 * clearly no-showed. Never exposes the underlying report to the recipient;
 * callers only ever see "you're eligible for a replacement," not why.
 */
export async function grantReplacementAccessPass(userId: string, reason: string, extraDays: number): Promise<void> {
  await expireStalePassesForUser(userId);
  const activePass = await prisma.accessPass.findFirst({ where: { userId, status: "ACTIVE" } });

  if (activePass) {
    const newExpiry = computeExpiryDate(activePass.expiresAt ?? new Date(), extraDays);
    await prisma.$transaction([
      prisma.accessPass.update({ where: { id: activePass.id }, data: { expiresAt: newExpiry } }),
      prisma.accessPassEvent.create({
        data: { accessPassId: activePass.id, type: "REPLACEMENT_GRANTED", metadata: { reason, extraDays } },
      }),
    ]);
    return;
  }

  const replacement = await prisma.accessPass.create({
    data: {
      userId,
      status: "ACTIVE",
      durationDays: extraDays,
      activatedAt: new Date(),
      expiresAt: computeExpiryDate(new Date(), extraDays),
      activationEventType: "MANUAL",
      isReplacement: true,
    },
  });
  await prisma.accessPassEvent.create({
    data: { accessPassId: replacement.id, type: "REPLACEMENT_GRANTED", metadata: { reason } },
  });
}

/**
 * Lazily checked (no cron in the MVP) — call from a low-frequency,
 * already-authenticated path. Idempotent within the reminder window via a
 * NotificationLog check, so it's safe to call on every dashboard visit.
 */
export async function sendExpiryRemindersDue(): Promise<number> {
  const now = new Date();
  const activePasses = await prisma.accessPass.findMany({ where: { status: "ACTIVE" }, include: { user: true } });

  let sent = 0;
  for (const pass of activePasses) {
    if (!needsExpiryReminder(pass.expiresAt, now, REMINDER_THRESHOLD_DAYS)) continue;

    const recentReminder = await prisma.notificationLog.findFirst({
      where: {
        userId: pass.userId,
        type: "ACCESS_PASS_EXPIRY_REMINDER",
        sentAt: { gte: new Date(now.getTime() - REMINDER_THRESHOLD_DAYS * 24 * 60 * 60 * 1000) },
      },
    });
    if (recentReminder) continue;

    const expiresAtLabel = pass.expiresAt!.toLocaleDateString("he-IL");
    await getMailer().send({
      to: pass.user.email,
      subject: "הגישה שלכם ל-SamePath עומדת לפוג",
      text: `הגישה שלכם תפוג ב-${expiresAtLabel}. אין חידוש אוטומטי — ניתן להפעיל גישה נוספת בכל עת דרך האפליקציה.`,
      html: `<div dir="rtl"><p>הגישה שלכם תפוג ב-${expiresAtLabel}.</p><p>אין חידוש אוטומטי — ניתן להפעיל גישה נוספת בכל עת דרך האפליקציה.</p></div>`,
    });
    await prisma.notificationLog.create({
      data: {
        userId: pass.userId,
        type: "ACCESS_PASS_EXPIRY_REMINDER",
        payload: { accessPassId: pass.id, expiresAt: pass.expiresAt },
      },
    });
    sent += 1;
  }
  return sent;
}
