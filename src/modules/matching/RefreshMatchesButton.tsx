"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { refreshSuggestionsAction } from "@/modules/matching/actions";

export function RefreshMatchesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await refreshSuggestionsAction();
          router.refresh();
        })
      }
      className="px-4 py-2 text-sm"
    >
      {pending ? "מחפש/ת התאמות…" : "חיפוש התאמות חדשות"}
    </Button>
  );
}
