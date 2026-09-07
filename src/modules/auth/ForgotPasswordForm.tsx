"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { requestPasswordResetAction } from "@/modules/auth/actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await requestPasswordResetAction(email);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <p className="rounded-xl bg-mint px-4 py-3 text-sm text-primary-dark">
        אם הכתובת {email} רשומה אצלנו, שלחנו אליה קישור לאיפוס הסיסמה.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
          כתובת אימייל
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
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "שולח…" : "שליחת קישור לאיפוס"}
      </Button>
    </form>
  );
}
