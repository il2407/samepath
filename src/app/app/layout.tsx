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
          <Link href="/app" className="text-lg font-bold text-ink">
            SamePath
          </Link>
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
