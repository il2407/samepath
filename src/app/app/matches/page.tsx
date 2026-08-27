import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { getActiveSuggestionsForUser } from "@/modules/matching/service";
import { SuggestionCard } from "@/modules/matching/SuggestionCard";
import { RefreshMatchesButton } from "@/modules/matching/RefreshMatchesButton";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "הצעות התאמה — SamePath" };

export default async function MatchesPage() {
  const user = await requireUser();
  if ((await getOnboardingStep(user.id)) !== "done") redirect("/app");

  const suggestions = await getActiveSuggestionsForUser(user.id);

  return (
    <Container className="max-w-2xl py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">הצעות התאמה</h1>
        <RefreshMatchesButton />
      </div>
      <p className="mt-2 text-muted">
        התאמות אנונימיות ומצומצמות. שם מלא, תמונה ומעסיק נחשפים רק לאחר אישור הדדי.
      </p>

      <div className="mt-8 space-y-4">
        {suggestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            אין כרגע הצעות התאמה. לחצו על &quot;חיפוש התאמות חדשות&quot; כדי לבדוק שוב.
          </div>
        ) : (
          suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              matchSuggestionId={s.id}
              candidate={s.candidate}
              reasons={s.reasons}
              waitingOnOther={s.waitingOnOther}
            />
          ))
        )}
      </div>
    </Container>
  );
}
