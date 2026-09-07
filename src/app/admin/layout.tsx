import Link from "next/link";
import { requireModerator } from "@/modules/auth/session";
import { logoutAction } from "@/modules/auth/actions";
import { Container } from "@/shared/ui/Container";
import { Logo } from "@/shared/ui/Logo";

const navItems = [
  { href: "/admin", label: "לוח בקרה" },
  { href: "/admin/contributions", label: "מודרציית תרומות" },
  { href: "/admin/interview-library", label: "ספריית ראיונות" },
  { href: "/admin/reports", label: "דיווחים" },
  { href: "/admin/takedowns", label: "בקשות הסרה" },
  { href: "/admin/groups", label: "קבוצות" },
  { href: "/admin/guides", label: "מדריכים" },
  { href: "/admin/companies", label: "חברות" },
  { href: "/admin/reward-policies", label: "מדיניות תגמול" },
  { href: "/admin/access", label: "גישה ותשלומים" },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireModerator();

  return (
    <div className="min-h-screen bg-paper" dir="rtl">
      <header className="border-b border-border bg-ink text-white">
        <Container className="flex h-14 items-center justify-between">
          <Link href="/admin" className="inline-flex items-center gap-2" aria-label="SamePath">
            <Logo variant="mono" wordmarkClassName="text-sm" />
            <span className="text-sm font-bold text-white/70">· ניהול</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-white/70">
            <span>{user.email}</span>
            <Link href="/app" className="hover:text-white">
              חזרה לאפליקציה
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="hover:text-white">
                יציאה
              </button>
            </form>
          </div>
        </Container>
      </header>
      <div className="flex">
        <nav className="min-h-[calc(100vh-56px)] w-56 shrink-0 border-l border-border bg-white p-4">
          <ul className="space-y-1 text-sm">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-lg px-3 py-2 text-ink hover:bg-mint">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
