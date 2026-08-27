import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/shared/ui/Container";
import { AuthForm } from "@/modules/auth/AuthForm";
import { redirectIfAuthenticated } from "@/modules/auth/session";

export const metadata: Metadata = { title: "כניסה — SamePath" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await redirectIfAuthenticated();
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-mint to-paper py-16">
      <Container className="max-w-md">
        <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
          <Link href="/" className="text-lg font-bold text-ink">
            SamePath
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">כניסה לחשבון</h1>
          <p className="mt-2 text-sm text-muted">נשלח קוד בן 6 ספרות לכתובת האימייל שלכם.</p>
          {params?.linkError && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              הקישור פג תוקף או שכבר נעשה בו שימוש. אפשר לבקש קוד חדש למטה.
            </p>
          )}
          <div className="mt-6">
            <AuthForm mode="login" />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            עדיין אין לכם חשבון?{" "}
            <Link href="/register" className="font-medium text-primary hover:text-primary-dark">
              הצטרפות
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
