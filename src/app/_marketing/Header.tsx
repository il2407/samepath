import Link from "next/link";
import { Container } from "@/shared/ui/Container";
import { LinkButton } from "@/shared/ui/Button";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">
          SamePath
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#how-it-works" className="hover:text-ink">
            איך זה עובד
          </a>
          <a href="#privacy" className="hover:text-ink">
            פרטיות
          </a>
          <a href="#faq" className="hover:text-ink">
            שאלות נפוצות
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm font-medium text-ink hover:text-primary sm:block">
            כניסה
          </Link>
          <LinkButton href="/register" className="px-5 py-2 text-sm">
            הצטרפות
          </LinkButton>
        </div>
      </Container>
    </header>
  );
}
