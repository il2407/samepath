"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  resolveUserReportAction,
  resolveContentReportAction,
  unpublishExperienceForReviewAction,
} from "@/modules/admin/report-actions";

const categoryLabels: Record<string, string> = {
  SAFETY_CONCERN: "חשש בטיחותי",
  HARASSMENT: "הטרדה",
  SPAM: "ספאם",
  FAKE_PROFILE: "פרופיל מזויף",
  PRIVACY_CONCERN: "חשש פרטיות",
  NO_SHOW: "אי הגעה",
  OTHER: "אחר",
};

const reasonLabels: Record<string, string> = {
  PERSONAL_DATA: "מידע אישי חושפני",
  CONFIDENTIAL_INFO: "מידע חסוי",
  FABRICATED: "תוכן מפוברק",
  DUPLICATE: "כפילות",
  OFFENSIVE: "תוכן פוגעני",
  OTHER: "אחר",
};

export interface UserReportRow {
  id: string;
  category: string;
  description: string;
  createdAt: Date;
  reporter: { email: string };
  reportedUser: { email: string } | null;
}

export interface ContentReportRow {
  id: string;
  reason: string;
  description: string | null;
  createdAt: Date;
  experienceId: string;
  experience: { company: { canonicalName: string } };
}

function UserReportCard({ report }: { report: UserReportRow }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resolve(status: "RESOLVED" | "DISMISSED") {
    setError(null);
    startTransition(async () => {
      const result = await resolveUserReportAction({ reportId: report.id, status, resolutionNote: note });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-warm-surface px-2.5 py-1 text-xs text-ink">{categoryLabels[report.category] ?? report.category}</span>
        <span className="text-xs text-muted">{report.createdAt.toLocaleDateString("he-IL")}</span>
      </div>
      <p className="mt-2 text-sm text-ink/80">{report.description}</p>
      <p className="mt-2 text-xs text-muted">
        מדווח/ת: {report.reporter.email} {report.reportedUser && <>· על: {report.reportedUser.email}</>}
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="הערת סגירה"
          className="min-w-40 flex-1 rounded-lg border border-border px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() => resolve("RESOLVED")}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          טיפול הושלם
        </button>
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() => resolve("DISMISSED")}
          className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-primary disabled:opacity-50"
        >
          דחיית הדיווח
        </button>
      </div>
    </div>
  );
}

function ContentReportCard({ report }: { report: ContentReportRow }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveContentReportAction({ reportId: report.id, resolution: note });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }
  function unpublish() {
    setError(null);
    startTransition(async () => {
      const result = await unpublishExperienceForReviewAction({
        experienceId: report.experienceId,
        reason: note || "unpublished pending report review",
      });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs text-danger-dark">{reasonLabels[report.reason] ?? report.reason}</span>
        <span className="text-xs text-muted">{report.createdAt.toLocaleDateString("he-IL")}</span>
      </div>
      <p className="mt-2 text-sm text-ink">חברה: {report.experience.company.canonicalName}</p>
      {report.description && <p className="mt-2 text-sm text-ink/80">{report.description}</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="הערה / סיבה"
          className="min-w-40 flex-1 rounded-lg border border-border px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={resolve}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          סגירת דיווח
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={unpublish}
          className="rounded-full px-4 py-1.5 text-sm text-danger hover:bg-danger/10"
        >
          הסרה זמנית לבדיקה
        </button>
      </div>
    </div>
  );
}

export function ReportsQueue({ userReports, contentReports }: { userReports: UserReportRow[]; contentReports: ContentReportRow[] }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-muted">דיווחים בין משתמשים ({userReports.length})</h2>
        <div className="mt-3 space-y-3">
          {userReports.length === 0 && <p className="text-sm text-muted">אין דיווחים פתוחים</p>}
          {userReports.map((r) => (
            <UserReportCard key={r.id} report={r} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted">דיווחים על תוכן ספריית ראיונות ({contentReports.length})</h2>
        <div className="mt-3 space-y-3">
          {contentReports.length === 0 && <p className="text-sm text-muted">אין דיווחים פתוחים</p>}
          {contentReports.map((r) => (
            <ContentReportCard key={r.id} report={r} />
          ))}
        </div>
      </section>
    </div>
  );
}
