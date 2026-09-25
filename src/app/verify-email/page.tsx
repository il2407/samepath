import { AuthShell } from "@/modules/auth/AuthShell";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/shared/ui/Container";
import { VerifyEmailForm } from "@/modules/auth/VerifyEmailForm";
import { getPendingVerificationId, redirectIfAuthenticated } from "@/modules/auth/session";

export const metadata: Metadata = { title: "אימות כתובת האימייל — SamePath" };

export default async function VerifyEmailPage() {
  await redirectIfAuthenticated();
  const verificationId = await getPendingVerificationId();

  return (
    <AuthShell>
      <Container className="max-w-md">
        <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
          <Link href="/" className="text-lg font-bold text-ink">
            SamePath
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">אימות כתובת האימייל</h1>
          {verificationId ? (
            <>
              <p className="mt-2 text-sm text-muted">שלחנו קוד בן 6 ספרות לכתובת האימייל שלכם. הזינו אותו כאן.</p>
              <div className="mt-6">
                <VerifyEmailForm />
              </div>
            </>
          ) : (
            <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">
              תוקף האימות פג. אפשר{" "}
              <Link href="/register" className="font-medium underline">
                להירשם מחדש
              </Link>
              .
            </p>
          )}
        </div>
      </Container>
    </AuthShell>
  );
}
