import { prisma } from "@/shared/db";
import type { Prisma } from "@/generated/prisma/client";
import { NOTIFICATION_TYPES, type NotificationType } from "@/modules/notifications/types";

export { NOTIFICATION_TYPES, type NotificationType };

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload?: Prisma.InputJsonValue,
) {
  return prisma.notification.create({
    data: { userId, type, payload },
  });
}

export async function listNotificationsForUser(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
