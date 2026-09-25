"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { resendVerificationCodeAction, verifyEmailCodeAction } from "@/modules/auth/actions";

const CODE_LENGTH = 6;

export function VerifyEmailForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyEmailCodeAction(code);
      if (result && !result.ok) {
        setError(result.error ?? "משהו השתבש. נסו שוב");
      }
    });
  }

  function handleResend() {
    setError(null);
    setResendMessage(null);
    startResendTransition(async () => {
      const result = await resendVerificationCodeAction();
      if (result.ok) {
        setResendMessage("קוד חדש נשלח לאימייל שלכם");
      } else {
        setError(result.error ?? "לא ניתן לשלוח קוד חדש כרגע");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-ink">
          קוד האימות
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={CODE_LENGTH}
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
          placeholder="000000"
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-ink placeholder:text-muted focus-visible:border-primary"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {resendMessage && !error && <p className="text-sm text-primary-dark">{resendMessage}</p>}

      <Button type="submit" disabled={pending || code.length !== CODE_LENGTH} className="w-full">
        {pending ? "רגע…" : "אימות"}
      </Button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resendPending}
        className="w-full text-center text-sm font-medium text-primary hover:text-primary-dark"
      >
        {resendPending ? "שולח…" : "לא קיבלתם קוד? שליחה מחדש"}
      </button>
    </form>
  );
}
