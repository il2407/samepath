import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/modules/auth/session";
import {
  ANALYTICS_PERIODS,
  getAdminAnalytics,
  parseAnalyticsPeriod,
  type AdminAnalytics,
  type JobRunTile,
} from "@/modules/admin/analytics";

export const metadata: Metadata = { title: "אנליטיקה — SamePath Admin" };

/** Renders a seconds duration as whole days, or hours when under a day —
 * null (no data yet) renders as "—", never NaN/Infinity. */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const hours = seconds / 3600;
  if (hours < 24) return `${Math.max(0, Math.round(hours))} שעות`;
  return `${(hours / 24).toFixed(1)} ימים`;
}

function formatDateTime(date: Date | null): string {
  return date ? date.toLocaleString("he-IL") : "—";
}

const JOB_STATUS_LABELS: Record<string, string> = {
  RUNNING: "בתהליך",
  SUCCESS: "הצלחה",
  PARTIAL: "הצלחה חלקית",
  FAILURE: "כשלון",
};

function JobRunCard({ title, run, emptyLabel }: { title: string; run: JobRunTile | null; emptyLabel: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <p className="text-xs font-semibold text-muted">{title}</p>
      {!run ? (
        <p className="mt-2 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <div className="mt-2 space-y-1 text-sm">
          <p className="text-ink">
            {formatDateTime(run.startedAt)} · {JOB_STATUS_LABELS[run.status] ?? run.status}
          </p>
          <p className="text-muted">
            {run.usersProcessed} משתמשים · {run.matchesCreated} התאמות · {run.notificationsSent} התראות
            {run.failedUserCount > 0 ? ` · ${run.failedUserCount} כשלונות משתמש` : ""}
          </p>
          {run.errorSummary ? (
            <p className="truncate text-xs text-muted" title={run.errorSummary}>
              {run.errorSummary}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AnalyticsView({ data }: { data: AdminAnalytics }) {
  const tiles = [
    { label: "סה״כ משתמשים רשומים", value: data.totalUsers },
    { label: `משתמשים חדשים (${data.periodDays} ימים אחרונים)`, value: data.newUsers },
    { label: "הצעות התאמה (סה״כ)", value: data.totalSuggestions },
    { label: `הצעות חדשות (${data.periodDays} ימים אחרונים)`, value: data.newSuggestions },
    { label: "התאמות מאושרות הדדית (סה״כ)", value: data.totalConfirmedMatches },
    { label: `התאמות מאושרות חדשות (${data.periodDays} ימים אחרונים)`, value: data.newConfirmedMatches },
    { label: "מעולם לא קיבלו הצעת התאמה", value: data.usersWithoutMatch },
    { label: "זמן ממוצע עד התאמה ראשונה", value: formatDuration(data.avgSecondsToFirstMatch) },
    { label: "זמן חציוני עד התאמה ראשונה", value: formatDuration(data.medianSecondsToFirstMatch) },
    { label: "כשלונות ריצת עבודת ההתאמה (סה״כ)", value: data.failedJobRunCount },
  ];

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-border bg-white p-5">
            <p className="text-2xl font-bold text-ink">{t.value}</p>
            <p className="mt-1 text-xs text-muted">{t.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted">עבודת ההתאמה האוטומטית</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <JobRunCard title="ריצה אחרונה שהצליחה" run={data.lastSuccessfulRun} emptyLabel="לא נרשמה עדיין ריצה מוצלחת" />
        <JobRunCard title="ריצה אחרונה שנכשלה" run={data.lastFailedRun} emptyLabel="לא נרשמה עדיין ריצה שנכשלה" />
        <JobRunCard title="הריצה האחרונה (כל סטטוס)" run={data.mostRecentRun} emptyLabel="העבודה עדיין לא רצה" />
      </div>
    </>
  );
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  // Stricter than the /admin layout's requireModerator() gate — this page
  // surfaces more than the coarse moderator-level pages should see, per the
  // backlog's explicit instruction. Do not rely on the layout gate alone.
  await requireAdmin();

  const params = await searchParams;
  const periodDays = parseAnalyticsPeriod(params?.period as string | string[] | undefined);

  let data: AdminAnalytics | null = null;
  let failed = false;
  try {
    data = await getAdminAnalytics(periodDays);
  } catch {
    // Isolate a bad analytics query from taking down the whole admin page —
    // render a failure state instead of letting this 500 the route.
    failed = true;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">אנליטיקה</h1>
        <div className="flex gap-2">
          {ANALYTICS_PERIODS.map((days) => (
            <Link
              key={days}
              href={`/admin/analytics?period=${days}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                days === periodDays
                  ? "border-primary bg-mint text-ink"
                  : "border-border bg-white text-muted hover:border-primary"
              }`}
            >
              {days} ימים אחרונים
            </Link>
          ))}
        </div>
      </div>

      {failed || !data ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-white p-8 text-center text-muted">
          לא ניתן היה לטעון את נתוני האנליטיקה כרגע. נסו לרענן את הדף, ואם התקלה
          נמשכת פנו לצוות הפיתוח.
        </div>
      ) : (
        <AnalyticsView data={data} />
      )}
    </div>
  );
}
