import { AuthShell } from "@/modules/auth/AuthShell";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/shared/ui/Container";
import { LinkButton } from "@/shared/ui/Button";
import { AuthForm } from "@/modules/auth/AuthForm";
import { redirectIfAuthenticated } from "@/modules/auth/session";

export const metadata: Metadata = { title: "כניסה — SamePath" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await redirectIfAuthenticated();
  const params = await searchParams;

  return (
    <AuthShell>
      <Container className="max-w-md">
        <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
          <Link href="/" className="text-lg font-bold text-ink">
            SamePath
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">כניסה לחשבון</h1>
          {params?.confirmError && (
            <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">
              קישור האימות פג תוקף או שכבר נעשה בו שימוש.
            </p>
          )}
          {params?.googleError === "account_disabled" && (
            <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">
              החשבון הזה נחסם ואין אליו גישה.
            </p>
          )}
          {params?.googleError && params.googleError !== "account_disabled" && (
            <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">
              ההתחברות עם Google נכשלה. אפשר לנסות שוב, או להתחבר עם אימייל וסיסמה.
            </p>
          )}
          <div className="mt-6">
            <AuthForm mode="login" />
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">חדשים כאן?</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <LinkButton href="/register" variant="secondary" className="mt-4 w-full">
            יצירת חשבון חדש
          </LinkButton>
        </div>
      </Container>
    </AuthShell>
  );
}
