"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import {
  requestLoginCodeAction,
  requestRegisterCodeAction,
  submitVerificationCodeAction,
} from "@/modules/auth/actions";

type Mode = "register" | "login";
type Step = "email" | "code";

export function AuthForm({ mode }: { mode: Mode }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const requestAction = mode === "register" ? requestRegisterCodeAction : requestLoginCodeAction;

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestAction(email);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש. נסו שוב");
        return;
      }
      setStep("code");
      setNotice(`שלחנו קוד בן 6 ספרות לכתובת ${email}`);
    });
  }

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitVerificationCodeAction(code);
      // A successful verification redirects server-side and never returns here.
      if (result && !result.ok) {
        setError(result.error ?? "משהו השתבש. נסו שוב");
      }
    });
  }

  function handleResend() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await requestAction(email);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש. נסו שוב");
        return;
      }
      setNotice("שלחנו קוד חדש לתיבת המייל");
    });
  }

  if (step === "email") {
    return (
      <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
            כתובת אימייל אישית
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-ink placeholder:text-muted focus-visible:border-primary"
          />
          <p className="mt-1.5 text-xs text-muted">אין צורך במייל של העבודה — מיועד לשימוש אישי בלבד.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "שולח…" : "שליחת קוד"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCodeSubmit} className="space-y-4" noValidate>
      {notice && <p className="rounded-xl bg-mint px-4 py-3 text-sm text-primary-dark">{notice}</p>}
      <div>
        <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-ink">
          קוד בן 6 ספרות
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-2xl tracking-[0.4em] text-ink placeholder:text-muted focus-visible:border-primary"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending || code.length !== 6} className="w-full">
        {pending ? "מאמת…" : "אישור"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => setStep("email")}
          className="text-muted hover:text-ink"
          disabled={pending}
        >
          שינוי כתובת
        </button>
        <button
          type="button"
          onClick={handleResend}
          className="font-medium text-primary hover:text-primary-dark"
          disabled={pending}
        >
          שליחת קוד מחדש
        </button>
      </div>
    </form>
  );
}
