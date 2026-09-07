"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { resetPasswordAction } from "@/modules/auth/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordAction({ token, password });
      if (result && !result.ok) {
        setError(result.error ?? "משהו השתבש. נסו שוב");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
          סיסמה חדשה
        </label>
        <div className="relative">
          <input
            id="password"
            type={visible ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-border bg-white px-4 py-3 pl-4 pr-12 text-ink placeholder:text-muted focus-visible:border-primary"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted hover:text-ink"
            tabIndex={-1}
          >
            {visible ? "הסתרה" : "הצגה"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted">לפחות 8 תווים.</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "רגע…" : "עדכון סיסמה"}
      </Button>
    </form>
  );
}
