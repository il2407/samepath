import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/shared/ui/Container";
import { ForgotPasswordForm } from "@/modules/auth/ForgotPasswordForm";
import { redirectIfAuthenticated } from "@/modules/auth/session";

export const metadata: Metadata = { title: "איפוס סיסמה — SamePath" };

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-mint to-paper py-16">
      <Container className="max-w-md">
        <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
          <Link href="/" className="text-lg font-bold text-ink">
            SamePath
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">איפוס סיסמה</h1>
          <p className="mt-2 text-sm text-muted">נשלח אליכם קישור לבחירת סיסמה חדשה.</p>
          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            נזכרתם בסיסמה?{" "}
            <Link href="/login" className="font-medium text-primary hover:text-primary-dark">
              כניסה
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
