"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { loginWithPasswordAction, registerWithPasswordAction } from "@/modules/auth/actions";
import { isValidPassword } from "@/modules/auth/validation";

type Mode = "register" | "login";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

export function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "register" && password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    startTransition(async () => {
      const result =
        mode === "register"
          ? await registerWithPasswordAction({ email, password })
          : await loginWithPasswordAction({ email, password });
      // A successful submit redirects server-side and never returns here.
      if (result && !result.ok) {
        setError(result.error ?? "משהו השתבש. נסו שוב");
      }
    });
  }

  return (
    <div className="space-y-6">
      <a
        href="/api/auth/google/start"
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-6 py-3 text-sm font-medium text-ink shadow-sm transition-colors hover:border-primary hover:text-primary"
      >
        <GoogleIcon />
        {mode === "register" ? "הרשמה עם Google" : "כניסה עם Google"}
      </a>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">או באמצעות אימייל</span>
        <div className="h-px flex-1 bg-border" />
      </div>

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
          {mode === "register" && (
            <p className="mt-1.5 text-xs text-muted">אין צורך במייל של העבודה — מיועד לשימוש אישי בלבד.</p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              סיסמה
            </label>
            {mode === "login" && (
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:text-primary-dark">
                שכחתם סיסמה?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
          {mode === "register" && <PasswordRequirements password={password} />}
        </div>

        {mode === "register" && (
          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-ink">
              אימות סיסמה
            </label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={showPassword}
              onToggleVisible={() => setShowPassword((v) => !v)}
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && (
              <p className={cn("mt-1.5 text-xs", confirmPassword === password ? "text-primary-dark" : "text-danger")}>
                {confirmPassword === password ? "הסיסמאות תואמות" : "הסיסמאות אינן תואמות"}
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "רגע…" : mode === "register" ? "יצירת חשבון" : "כניסה"}
        </Button>

        {mode === "register" && (
          <p className="text-center text-xs text-muted">
            בלחיצה על “יצירת חשבון” אתם מאשרים שקראתם ומסכימים ל
            <Link href="/terms" className="font-medium text-ink hover:text-primary">
              תנאי השימוש
            </Link>{" "}
            ול
            <Link href="/privacy" className="font-medium text-ink hover:text-primary">
              מדיניות הפרטיות
            </Link>
            .
          </p>
        )}
      </form>
    </div>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const meetsRequirements = isValidPassword(password);

  return (
    <div className="mt-2 rounded-xl bg-sand px-4 py-3">
      <div className={cn("flex items-center gap-1.5 text-xs", meetsRequirements ? "text-primary-dark" : "text-muted")}>
        <RequirementIcon met={meetsRequirements} />
        <span>לפחות {MIN_PASSWORD_LENGTH} תווים, עם אות ומספר</span>
      </div>
    </div>
  );
}

function RequirementIcon({ met }: { met: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
      <circle cx="7" cy="7" r="6.5" className={met ? "fill-primary" : "fill-none stroke-border"} strokeWidth="1.5" />
      {met && (
        <path
          d="M4 7.2l1.8 1.8L10 4.8"
          stroke="white"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  visible,
  onToggleVisible,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        required
        minLength={MIN_PASSWORD_LENGTH}
        maxLength={MAX_PASSWORD_LENGTH}
        autoComplete={autoComplete}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        className="w-full rounded-xl border border-border bg-white px-4 py-3 pl-4 pr-12 text-ink placeholder:text-muted focus-visible:border-primary"
      />
      <button
        type="button"
        onClick={onToggleVisible}
        className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted hover:text-ink"
        tabIndex={-1}
      >
        {visible ? "הסתרה" : "הצגה"}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={cn("shrink-0")}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
