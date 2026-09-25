"use client";

import { Button } from "@/shared/ui/Button";

/**
 * Root error boundary. Shows no error details — in production Next.js only
 * forwards a `digest`, which we surface as a reference code so a support
 * report can be matched to the server log line from `instrumentation.ts`.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">משהו השתבש</h1>
      <p className="text-muted">אירעה שגיאה בלתי צפויה. אפשר לנסות שוב, ואם הבעיה חוזרת — לחזור מאוחר יותר.</p>
      <Button onClick={() => retry()}>לנסות שוב</Button>
      {error.digest ? (
        <p className="text-xs text-muted">
          קוד לפנייה לתמיכה: <span dir="ltr" className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </main>
  );
}
