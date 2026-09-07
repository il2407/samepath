import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { getActiveSuggestionsForUser, getMidStageMatchesForUser } from "@/modules/matching/service";
import { SuggestionCard } from "@/modules/matching/SuggestionCard";
import { RefreshMatchesButton } from "@/modules/matching/RefreshMatchesButton";
import { Container } from "@/shared/ui/Container";
import { Avatar } from "@/shared/ui/Avatar";
import { CvVerifiedBadge } from "@/shared/ui/CvVerifiedBadge";

export const metadata: Metadata = { title: "הצעות התאמה — SamePath" };

export default async function MatchesPage() {
  const user = await requireUser();
  if ((await getOnboardingStep(user.id)) !== "done") redirect("/app");

  const [suggestions, midStageMatches] = await Promise.all([
    getActiveSuggestionsForUser(user.id),
    getMidStageMatchesForUser(user.id),
  ]);

  return (
    <Container className="max-w-2xl py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">הצעות התאמה</h1>
        <RefreshMatchesButton />
      </div>
      <p className="mt-2 text-muted">
        כל הצעה מוצגת עם כינוי ואייקון אקראיים.
        <br />
        שם פרטי (אם הצד השני בחר לחשוף אותו מוקדם) מוצג לאחר עניין הדדי; שם מלא, תמונה, מיקום,
        אימייל וטלפון נחשפים רק לאחר יצירת חיבור פעיל.
      </p>

      {midStageMatches.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold text-ink">התאמות הדדיות — בדרך לחיבור</h2>
          <p className="text-sm text-muted">
            שני הצדדים הביעו עניין הדדי. ברגע ששניכם תפעילו כרטיס גישה, ייפתח חיבור אמיתי ותוכלו
            לשוחח.
          </p>
          <div className="space-y-3">
            {midStageMatches.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
                <Avatar seed={m.codeName} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                    {m.candidate.firstName ?? m.codeName}
                    {m.candidate.cvVerified && <CvVerifiedBadge />}
                  </p>
                  <p className="text-sm text-muted">
                    {[m.candidate.company, m.candidate.professionalField].filter(Boolean).join(" · ")} ·{" "}
                    {m.matchPercentage}% התאמה
                  </p>
                </div>
                {m.status === "ACCESS_CHECK" && (
                  <div className="shrink-0 text-end">
                    {m.viewerNeedsAccessPass ? (
                      <Link href="/app/access" className="text-sm font-medium text-primary hover:text-primary-dark">
                        להפעלת כרטיס גישה
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">ממתין/ה לצד השני</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <details className="group mt-4 rounded-2xl border border-border bg-white p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-focus">
          איך מחושב אחוז ההתאמה?
          <span className="shrink-0 font-mono text-primary transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="mt-3 text-sm leading-relaxed text-muted">
          <p>האחוז משקלל יחד כמה גורמים, לפי סדר ההשפעה שלהם על הציון הכולל:</p>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            <li>
              <strong className="text-ink">המשפיעים ביותר:</strong> תפקיד היעד שאתם מחפשים והתחום המקצועי.
            </li>
            <li>
              <strong className="text-ink">השפעה בינונית:</strong> רמת הניסיון וחפיפת הזמינות.
            </li>
            <li>
              <strong className="text-ink">משלימים את התמונה:</strong> כישורים ותגיות משותפות, שפה, אזור זמן
              וסגנון החיבור המועדף.
            </li>
          </ul>
          <p className="mt-3">
            כל גורם מקבל ציון משלו לפי מידת ההתאמה בו, וכל ציון נכנס לחישוב הכולל ביחס למידת ההשפעה
            שלו כפי שמפורט למעלה — כך שגורם משמעותי כמו תפקיד היעד מכריע יותר מגורם משני כמו סגנון
            החיבור המועדף.
          </p>
          <p className="mt-3">
            בכל כרטיס הצעה, &quot;למה זה מתאים&quot; מציג עד שלושה מהגורמים החזקים ביותר בהתאמה הזו, עם
            האחוז הספציפי של כל אחד מהם. ההצעות למטה תמיד מסודרות מהאחוז הכולל הגבוה ביותר לנמוך
            ביותר.
          </p>
        </div>
      </details>

      <div className="mt-6 space-y-4">
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
              codeName={s.codeName}
              matchPercentage={s.matchPercentage}
              reasons={s.reasons}
              waitingOnOther={s.waitingOnOther}
            />
          ))
        )}
      </div>
    </Container>
  );
}
