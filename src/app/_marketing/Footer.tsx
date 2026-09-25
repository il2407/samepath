import Link from "next/link";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";
import { Logo } from "@/shared/ui/Logo";
import { PRICING_ENABLED } from "@/shared/features";

export function Footer() {
  return (
    <Reveal y={12}>
      <footer className="border-t border-ink/10 bg-paper py-12">
        <Container className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo />
            <p className="mt-2 max-w-xs text-sm text-muted">
              קהילה מקצועית ודיסקרטית לאנשים שלא רוצים לחפש עבודה ולהתכונן
              לראיונות לבד.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-muted sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
            <a href="#privacy" className="hover:text-ink">
              פרטיות
            </a>
            <a href="#how-it-works" className="hover:text-ink">
              איך זה עובד
            </a>
            {PRICING_ENABLED && (
              <a href="#pricing" className="hover:text-ink">
                מחיר
              </a>
            )}
            <a href="#faq" className="hover:text-ink">
              שאלות נפוצות
            </a>
            <Link href="/login" className="hover:text-ink">
              כניסה
            </Link>
            <a href="mailto:hello@samepath.app" className="hover:text-ink">
              יצירת קשר
            </a>
          </nav>
        </Container>
        <Container className="mt-10 border-t border-ink/12 pt-6">
          <p className="font-mono text-xs text-muted">
            © {new Date().getFullYear()} SamePath
          </p>
        </Container>
      </footer>
    </Reveal>
  );
}
