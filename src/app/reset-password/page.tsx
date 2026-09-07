import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/shared/ui/Container";
import { ResetPasswordForm } from "@/modules/auth/ResetPasswordForm";
import { redirectIfAuthenticated } from "@/modules/auth/session";

export const metadata: Metadata = { title: "בחירת סיסמה חדשה — SamePath" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-mint to-paper py-16">
      <Container className="max-w-md">
        <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
          <Link href="/" className="text-lg font-bold text-ink">
            SamePath
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">בחירת סיסמה חדשה</h1>
          {token ? (
            <div className="mt-6">
              <ResetPasswordForm token={token} />
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">
              הקישור אינו תקין. אפשר לבקש{" "}
              <Link href="/forgot-password" className="font-medium underline">
                קישור חדש
              </Link>
              .
            </p>
          )}
        </div>
      </Container>
    </main>
  );
}
