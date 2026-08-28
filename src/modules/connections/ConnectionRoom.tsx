"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import {
  blockConnectionAction,
  clearConnectionGuideAction,
  endConnectionAction,
  markMeetingAction,
  pickGuideForConnectionAction,
  reportConnectionAction,
  sendMessageAction,
} from "@/modules/connections/actions";
import { reportCategoryLabels } from "@/modules/profiles/labels";
import type { ConnectionDetail } from "@/modules/connections/service";

const roleLabels: Record<string, string> = { PRESENTER: "מציג/ה", LISTENER: "מקשיב/ה", BOTH: "שניכם" };

function SuggestedSession({
  connectionId,
  selectedGuide,
  categories,
}: {
  connectionId: string;
  selectedGuide: ConnectionDetail["selectedGuide"];
  categories: readonly { slug: string; labelHe: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(category: string) {
    setError(null);
    startTransition(async () => {
      const result = await pickGuideForConnectionAction({ connectionId, category });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  function clear() {
    startTransition(async () => {
      await clearConnectionGuideAction(connectionId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <h2 className="font-semibold text-ink">מבנה מפגש מוצע</h2>
      <p className="mt-1 text-sm text-muted">
        הצעה אופציונלית לתכנון הזמן ביחד, כדי ששניכם תדעו מראש למה לצפות — לא חובה להשתמש בה.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!selectedGuide ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              disabled={pending}
              onClick={() => pick(c.slug)}
              className="rounded-full border border-primary px-4 py-2 text-sm text-primary-dark hover:bg-mint disabled:opacity-50"
            >
              {c.labelHe}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-ink">{selectedGuide.title}</p>
              <p className="text-sm text-muted">{selectedGuide.purpose}</p>
            </div>
            <span className="shrink-0 rounded-full bg-mint px-3 py-1 text-xs text-primary-dark">
              כ-{selectedGuide.suggestedDurationMinutes} דק׳
            </span>
          </div>

          <ol className="mt-4 space-y-2">
            {selectedGuide.steps.map((step, index) => (
              <li key={step.id} className="rounded-xl border border-border bg-paper p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    {index + 1}. {step.title}
                  </p>
                  <div className="flex gap-1.5 text-xs">
                    <span className="rounded-full bg-white px-2 py-0.5 text-muted">{roleLabels[step.role] ?? step.role}</span>
                    {typeof step.durationMinutes === "number" && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-muted">{step.durationMinutes} דק׳</span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-ink/80">{step.prompt}</p>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {selectedGuide.category && (
              <button type="button" disabled={pending} onClick={() => pick(selectedGuide.category!)} className="text-primary hover:text-primary-dark">
                הצעה אחרת מאותה קטגוריה
              </button>
            )}
            <button type="button" disabled={pending} onClick={clear} className="text-muted hover:text-red-600">
              הסרת המבנה המוצע
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConnectionRoom({
  connection,
  currentUserId,
  categories,
}: {
  connection: ConnectionDetail;
  currentUserId: string;
  categories: readonly { slug: string; labelHe: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportCategory, setReportCategory] = useState("OTHER");
  const [reportDescription, setReportDescription] = useState("");

  const isActive = connection.status === "ACTIVE";

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await sendMessageAction(connection.id, messageText);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setMessageText("");
      router.refresh();
    });
  }

  function handleMarkCompleted() {
    startTransition(async () => {
      await markMeetingAction({ connectionId: connection.id, completedAt: new Date().toISOString() });
      router.refresh();
    });
  }

  function handleEnd() {
    startTransition(async () => {
      await endConnectionAction(connection.id);
      router.refresh();
    });
  }

  function handleBlock() {
    startTransition(async () => {
      await blockConnectionAction(connection.id);
      router.refresh();
    });
  }

  function submitReport() {
    startTransition(async () => {
      await reportConnectionAction({ connectionId: connection.id, category: reportCategory, description: reportDescription });
      setShowReport(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-mint text-lg font-semibold text-primary-dark">
            {connection.otherParty.displayName.slice(0, 1)}
          </div>
          <div>
            <p className="font-semibold text-ink">
              {connection.otherParty.fullName || connection.otherParty.displayName}
            </p>
            <p className="text-sm text-muted">
              {[connection.otherParty.professionalField, connection.otherParty.seniorityBand].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
          {connection.otherParty.email && <span>{connection.otherParty.email}</span>}
          {connection.otherParty.phoneNumber && <span dir="ltr">{connection.otherParty.phoneNumber}</span>}
          {connection.otherParty.linkedInUrl && (
            <a href={connection.otherParty.linkedInUrl} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-dark">
              LinkedIn
            </a>
          )}
        </div>
      </div>

      {isActive && <SuggestedSession connectionId={connection.id} selectedGuide={connection.selectedGuide} categories={categories} />}

      <div className="rounded-2xl border border-border bg-white p-6">
        <h2 className="font-semibold text-ink">שיחה</h2>
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
          {connection.messages.length === 0 ? (
            <p className="text-sm text-muted">עדיין אין הודעות. אפשר לפתוח בהיכרות קצרה.</p>
          ) : (
            connection.messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.senderId === currentUserId
                    ? "mr-auto max-w-[80%] rounded-2xl rounded-tl-sm bg-mint px-4 py-2 text-sm text-ink"
                    : "ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-paper px-4 py-2 text-sm text-ink"
                }
              >
                {m.body}
              </div>
            ))
          )}
        </div>
        {isActive && (
          <form onSubmit={handleSend} className="mt-4 flex gap-2">
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="הודעה…"
              className="flex-1 rounded-xl border border-border bg-white px-4 py-2"
            />
            <Button type="submit" disabled={pending} className="px-4 py-2 text-sm">
              שליחה
            </Button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {isActive && (
        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="font-semibold text-ink">מפגש</h2>
          <div className="mt-3 space-y-2 text-sm text-muted">
            {connection.meetingStatuses.length === 0 && <p>עדיין לא סומן מפגש.</p>}
            {connection.meetingStatuses.map((m) => (
              <p key={m.id}>
                {m.completedAt ? `הושלם ב-${new Date(m.completedAt).toLocaleDateString("he-IL")}` : "מתוכנן"}
              </p>
            ))}
          </div>
          <Button variant="secondary" onClick={handleMarkCompleted} disabled={pending} className="mt-3 px-4 py-2 text-sm">
            סימון מפגש כהושלם
          </Button>
        </div>
      )}

      {isActive && (
        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="font-semibold text-ink">ניהול החיבור</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleEnd} disabled={pending} className="px-4 py-2 text-sm">
              סיום החיבור
            </Button>
            <Button variant="secondary" onClick={handleBlock} disabled={pending} className="px-4 py-2 text-sm">
              חסימה
            </Button>
            <button
              type="button"
              onClick={() => setShowReport((v) => !v)}
              disabled={pending}
              className="px-3 py-2 text-sm text-muted hover:text-red-600"
            >
              דיווח
            </button>
          </div>
          {showReport && (
            <div className="mt-4 space-y-3 rounded-xl border border-border bg-paper p-4">
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              >
                {Object.entries(reportCategoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="פרטים"
                rows={2}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
              <Button onClick={submitReport} disabled={pending} className="px-4 py-2 text-sm">
                שליחת דיווח
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
