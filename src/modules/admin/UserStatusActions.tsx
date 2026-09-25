"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveUserAction, blockUserAction, unblockUserAction } from "@/modules/admin/user-actions";

export function UserStatusActions({ userId, email, status }: { userId: string; email: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(userId);
      if (!result.ok) setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  function block() {
    if (!window.confirm(`לחסום את ${email}? המשתמש/ת ינותקו מיד ולא יוכלו להיכנס או להירשם מחדש עם הכתובת הזו.`)) return;
    run(blockUserAction);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === "PENDING_APPROVAL" && (
        <button
          type="button"
          onClick={() => run(approveUserAction)}
          disabled={pending}
          className="rounded-full bg-primary px-3.5 py-1 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          אישור
        </button>
      )}
      {status === "SUSPENDED" ? (
        <button
          type="button"
          onClick={() => run(unblockUserAction)}
          disabled={pending}
          className="rounded-full border border-border px-3.5 py-1 text-xs hover:border-primary disabled:opacity-50"
        >
          ביטול חסימה
        </button>
      ) : (
        <button
          type="button"
          onClick={block}
          disabled={pending}
          className="rounded-full px-3.5 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          חסימה
        </button>
      )}
      {error && <span className="w-full text-end text-xs text-danger">{error}</span>}
    </div>
  );
}
