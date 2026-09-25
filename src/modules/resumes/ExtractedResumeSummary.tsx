import { calculateExperienceMonths } from "@/modules/profiles/experience";
import type { StoredExtractedResumeData } from "@/modules/resumes/dto";

interface Option {
  id: string;
  labelHe: string;
}

/** "YYYY-MM" -> a Date on the first of that month (UTC, to match calculateExperienceMonths' UTC math). */
function parseMonthString(month: string): Date {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1));
}

export function estimateExperienceYears(positions: StoredExtractedResumeData["positions"]): number | null {
  if (positions.length === 0) return null;
  const months = calculateExperienceMonths(
    positions.map((p) => ({
      startDate: parseMonthString(p.startMonth),
      endDate: p.isCurrent || !p.endMonth ? null : parseMonthString(p.endMonth),
    })),
  );
  return months > 0 ? Math.floor(months / 12) : null;
}

/**
 * The one structured view of "everything the parser found," shared by the
 * onboarding draft-review screen and the settings re-verification card so
 * both show the same field-by-field breakdown instead of each inventing its
 * own partial summary (see TASKS.md "תצוגת חילוץ מסודרת").
 */
export function ExtractedResumeSummary({
  extracted,
  skills,
  domains,
}: {
  extracted: StoredExtractedResumeData;
  skills: Option[];
  domains: Option[];
}) {
  const current = extracted.positions.find((p) => p.isCurrent) ?? null;
  const previousCompanies = extracted.positions.filter((p) => p !== current).map((p) => p.companyName);
  const tagLabels = [...skills, ...domains]
    .filter((t) => extracted.matchedTagIds.includes(t.id))
    .map((t) => t.labelHe);
  const experienceYears = estimateExperienceYears(extracted.positions);

  const rows: { label: string; value: React.ReactNode }[] = [];
  if (extracted.currentRoleTitleGuess || current?.title) {
    rows.push({ label: "תפקיד נוכחי", value: extracted.currentRoleTitleGuess ?? current!.title });
  }
  if (current) rows.push({ label: "חברה נוכחית", value: current.companyName });
  if (previousCompanies.length > 0) rows.push({ label: "חברות קודמות", value: previousCompanies.join(" · ") });
  if (tagLabels.length > 0) rows.push({ label: "תחומי התמחות", value: tagLabels.join(" · ") });
  if (experienceYears !== null) rows.push({ label: "שנות ניסיון", value: `כ-${experienceYears} שנים` });
  if (extracted.linkedInUrlGuess) {
    rows.push({
      label: "לינקדין",
      value: (
        <a href={extracted.linkedInUrlGuess} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          {extracted.linkedInUrlGuess}
        </a>
      ),
    });
  }

  if (rows.length === 0) return null;

  return (
    <dl className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted">{row.label}</dt>
          <dd className="font-medium text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
