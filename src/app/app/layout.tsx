import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { logoutAction } from "@/modules/auth/actions";
import { Container } from "@/shared/ui/Container";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border bg-white">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/app" className="text-lg font-bold text-ink">
              SamePath
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
              <Link href="/app/matches" className="hover:text-ink">
                הצעות התאמה
              </Link>
              <Link href="/app/connections" className="hover:text-ink">
                חיבורים
              </Link>
              <Link href="/app/groups" className="hover:text-ink">
                קבוצות
              </Link>
              <Link href="/app/guides" className="hover:text-ink">
                מדריכים
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted">{user.email}</span>
            <form action={logoutAction}>
              <button type="submit" className="font-medium text-ink hover:text-primary">
                יציאה
              </button>
            </form>
          </div>
        </Container>
      </header>
      <main>{children}</main>
    </div>
  );
}
