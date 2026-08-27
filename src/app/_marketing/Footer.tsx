import Link from "next/link";
import { Container } from "@/shared/ui/Container";

export function Footer() {
  return (
    <footer className="border-t border-border bg-warm-surface py-12">
      <Container className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-bold text-ink">SamePath</p>
          <p className="mt-2 max-w-xs text-sm text-muted">
            קהילה מקצועית דיסקרטית לאנשים שמחפשים תפקיד דומה לשלכם.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-muted sm:flex sm:gap-12">
          <Link href="/register" className="hover:text-ink">
            הצטרפות
          </Link>
          <Link href="/login" className="hover:text-ink">
            כניסה
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            פרטיות
          </Link>
          <Link href="/terms" className="hover:text-ink">
            תנאי שימוש
          </Link>
        </nav>
      </Container>
      <Container className="mt-10 border-t border-border pt-6">
        <p className="text-xs text-muted">© {new Date().getFullYear()} SamePath</p>
      </Container>
    </footer>
  );
}
