"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setGuideStatusAction } from "@/modules/admin/guide-actions";

export function GuideStatusActions({ guideId, status }: { guideId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(next: "PUBLISHED" | "ARCHIVED" | "DRAFT") {
    startTransition(async () => {
      await setGuideStatusAction(guideId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2 text-xs">
      {status !== "PUBLISHED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("PUBLISHED")}
          className="rounded-lg border border-primary px-2 py-1 text-primary-dark hover:bg-mint"
        >
          פרסום
        </button>
      )}
      {status !== "DRAFT" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("DRAFT")}
          className="rounded-lg border border-border px-2 py-1 text-muted hover:bg-paper"
        >
          לטיוטה
        </button>
      )}
      {status !== "ARCHIVED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("ARCHIVED")}
          className="rounded-lg border border-border px-2 py-1 text-muted hover:bg-paper"
        >
          ארכוב
        </button>
      )}
    </div>
  );
}
