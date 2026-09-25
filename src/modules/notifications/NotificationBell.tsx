"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/shared/ui/cn";
import { markAllNotificationsReadAction } from "@/modules/notifications/actions";
import { NOTIFICATION_TYPES, type NotificationType } from "@/modules/notifications/types";

export interface NotificationItem {
  id: string;
  type: string;
  createdAt: Date;
  readAt: Date | null;
}

const NOTIFICATION_COPY: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.NEW_MATCH]: "יש לכם הצעת התאמה חדשה",
  [NOTIFICATION_TYPES.NO_MATCHES_AVAILABLE]: "אין מספיק התאמות כרגע — המערכת ממשיכה לעבוד",
  [NOTIFICATION_TYPES.CONNECTION_COMPLETED]: "חיבור חדש נפתח בהצלחה",
  [NOTIFICATION_TYPES.ACCOUNT_APPROVED]: "החשבון שלכם אושר — מעכשיו תתחילו לקבל התאמות",
  [NOTIFICATION_TYPES.CONTRIBUTION_APPROVED]: "שאלות הראיון ששיתפתם אושרו על ידי הצוות",
  [NOTIFICATION_TYPES.CONTRIBUTION_REJECTED]: "שאלות הראיון ששיתפתם לא אושרו על ידי הצוות",
  [NOTIFICATION_TYPES.CONTRIBUTION_NEEDS_CHANGES]: "הצוות ביקש שינויים בשאלות הראיון ששיתפתם",
};

function describe(type: string): string {
  return NOTIFICATION_COPY[type as NotificationType] ?? "התראה חדשה";
}

export function NotificationBell({ initialNotifications, initialUnreadCount }: { initialNotifications: NotificationItem[]; initialUnreadCount: number }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setNotifications((rows) => rows.map((r) => (r.readAt ? r : { ...r, readAt: new Date() })));
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Opening the bell counts as seeing everything in it: the badge clears
  // immediately and every unread row is marked read on the server. The rows
  // keep their unread highlight while the panel stays open so the user can
  // still tell which ones are new, and lose it once the panel closes.
  function handleOpen() {
    if (open) return close();
    setOpen(true);
    if (unreadCount === 0) return;
    setUnreadCount(0);
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="התראות"
        aria-expanded={open}
        className="relative flex size-11 items-center justify-center rounded-full p-2 text-muted hover:bg-mint hover:text-ink"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-20 mt-2 w-80 rounded-2xl border border-border bg-white p-2 shadow-lg">
          <div className="px-2 py-1.5">
            <span className="text-sm font-semibold text-ink">התראות</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted">אין התראות עדיין</p>
            ) : (
              <ul className="space-y-1">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <div className={cn("flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-start text-sm", !n.readAt && "bg-mint/60")}>
                      <span className="text-ink">{describe(n.type)}</span>
                      <span className="text-xs text-muted">{n.createdAt.toLocaleDateString("he-IL")}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
