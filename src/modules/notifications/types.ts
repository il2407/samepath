/**
 * In-app notification types. Kept as string literals (matching
 * NotificationLog's `type` column) rather than a Prisma enum so a new
 * notification kind never requires a migration.
 *
 * This file must stay free of server-only imports (Prisma/db): it is
 * imported by the client-side NotificationBell component, and pulling in
 * `@/shared/db` here would bundle the `pg` driver into client JS.
 */
export const NOTIFICATION_TYPES = {
  NEW_MATCH: "NEW_MATCH",
  NO_MATCHES_AVAILABLE: "NO_MATCHES_AVAILABLE",
  CONNECTION_COMPLETED: "CONNECTION_COMPLETED",
  ACCOUNT_APPROVED: "ACCOUNT_APPROVED",
  CONTRIBUTION_APPROVED: "CONTRIBUTION_APPROVED",
  CONTRIBUTION_REJECTED: "CONTRIBUTION_REJECTED",
  CONTRIBUTION_NEEDS_CHANGES: "CONTRIBUTION_NEEDS_CHANGES",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
