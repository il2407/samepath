import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { logoutAction } from "@/modules/auth/actions";
import { Container } from "@/shared/ui/Container";
import { Logo } from "@/shared/ui/Logo";
import { NotificationBell } from "@/modules/notifications/NotificationBell";
import { getUnreadNotificationCount, listNotificationsForUser } from "@/modules/notifications/service";
import { searchNewSuggestionsOnVisit } from "@/modules/matching/service";
import { NewMatchesToast } from "@/modules/matching/NewMatchesToast";
import { AppNav } from "./AppNav";
import { UserMenu } from "./UserMenu";
import styles from "./platform.module.css";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  // Staff accounts live in the admin area — the member app isn't theirs.
  if (user.role !== "MEMBER") redirect("/admin");
  // Every entry to the platform looks for new matches first, so the bell
  // below already includes any NEW_MATCH notification this search creates.
  const newMatchCount = await searchNewSuggestionsOnVisit(user.id);
  const [notifications, unreadCount] = await Promise.all([
    listNotificationsForUser(user.id),
    getUnreadNotificationCount(user.id),
  ]);

  return (
    <div className={styles.platform}>
      <header className={styles.header}>
        <Container className={styles.headerInner}>
          <div className={styles.navigation}>
            <Link href="/app" aria-label="SamePath, מעבר לעמוד הראשי">
              <Logo wordmarkClassName="font-medium" />
            </Link>
            <AppNav />
          </div>
          <div className={styles.account}>
            <NotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
            <UserMenu email={user.email} />
            <form action={logoutAction}>
              <button type="submit" className={styles.logout}>
                יציאה
              </button>
            </form>
          </div>
        </Container>
      </header>
      {user.status === "PENDING_APPROVAL" && (
        <div role="status" className="border-b border-border bg-mint">
          <Container className="py-3 text-sm text-primary-dark">
            החשבון שלכם ממתין לאישור הצוות. בינתיים אפשר להשלים את הפרופיל — נעדכן אתכם במייל ברגע שהחשבון יאושר
            ותתחילו לקבל התאמות.
          </Container>
        </div>
      )}
      <main>{children}</main>
      {newMatchCount > 0 && <NewMatchesToast count={newMatchCount} />}
    </div>
  );
}
