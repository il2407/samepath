"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SharedPracticePanel } from "./SharedPracticePanel";
import { Button } from "@/shared/ui/Button";
import { Avatar } from "@/shared/ui/Avatar";
import { CvVerifiedBadge } from "@/shared/ui/CvVerifiedBadge";
import { InterviewContributorBadge } from "@/shared/ui/InterviewContributorBadge";
import { cn } from "@/shared/ui/cn";
import {
  attachMeetLinkForConnectionAction,
  blockConnectionAction,
  endConnectionAction,
  generateMeetLinkForConnectionAction,
  markMeetingAction,
  reportConnectionAction,
  sendMessageAction,
} from "@/modules/connections/actions";
import { reportCategoryLabels } from "@/modules/profiles/labels";
import type { ConnectionDetail } from "@/modules/connections/service";

// ---------------------------------------------------------------------------
// Google Meet link — create via the Meet API or attach a manually-pasted,
// backend-validated link. All coordination about meeting type, structure and
// timing happens in the free-form chat below, not in a separate flow. See
// src/modules/connections/meeting-link.ts and the README.
// ---------------------------------------------------------------------------

function MeetLinkPanel({
  connectionId,
  meetLink,
  hasGoogleMeetConnected,
}: {
  connectionId: string;
  meetLink: string | null;
  hasGoogleMeetConnected: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState("");

  function generateLink() {
    setError(null);
    startTransition(async () => {
      const result = await generateMeetLinkForConnectionAction({ connectionId });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      router.refresh();
    });
  }

  function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkDraft.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await attachMeetLinkForConnectionAction({ connectionId, meetLink: linkDraft });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setLinkDraft("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <h2 className="font-semibold text-ink">שיחת וידאו</h2>
      <p className="mt-1 text-sm text-muted">
        אפשר ליצור קישור חדש ל-Google Meet או לצרף קישור קיים. את הזמן והפורמט של המפגש הכי קל לתאם בצ׳אט למטה.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {meetLink && (
        <p className="mt-3 text-sm text-muted">
          קישור נוכחי:{" "}
          <a href={meetLink} target="_blank" rel="noreferrer" dir="ltr" className="break-all text-primary underline">
            {meetLink}
          </a>
        </p>
      )}

      <div className="mt-3">
        {hasGoogleMeetConnected ? (
          <Button variant="secondary" disabled={pending} onClick={generateLink} className="px-3 py-2 text-sm">
            יצירת קישור Google Meet
          </Button>
        ) : (
          <a
            href={`/api/auth/google-meet/start?returnTo=${encodeURIComponent(`/app/connections/${connectionId}`)}`}
            className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm text-primary hover:text-primary-dark"
          >
            התחברות ל-Google ליצירת קישור Meet
          </a>
        )}
      </div>

      <form onSubmit={submitLink} className="mt-3 flex gap-2">
        <label htmlFor="attach-meet-link" className="sr-only">
          קישור ל-Google Meet
        </label>
        <input
          id="attach-meet-link"
          type="url"
          dir="ltr"
          value={linkDraft}
          onChange={(e) => setLinkDraft(e.target.value)}
          placeholder={meetLink ? "עדכון קישור ל-Google Meet" : "הוספת קישור ל-Google Meet"}
          className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={pending || !linkDraft.trim()} className="px-3 py-2 text-sm">
          שמירה
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat (backlog item 13)
// ---------------------------------------------------------------------------

interface OptimisticMessage {
  clientId: string;
  body: string;
  createdAt: Date;
  status: "sending" | "failed";
  error?: string;
}

type DisplayMessage =
  | { kind: "sent"; id: string; senderId: string; body: string; createdAt: Date }
  | ({ kind: "optimistic" } & OptimisticMessage);

function formatMessageTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({
  message,
  mine,
  otherPartyDisplayName,
  otherPartyPhotoDataUrl,
  onRetry,
  onDiscard,
}: {
  message: DisplayMessage;
  mine: boolean;
  otherPartyDisplayName: string;
  otherPartyPhotoDataUrl: string | null;
  onRetry: (m: OptimisticMessage) => void;
  onDiscard: (clientId: string) => void;
}) {
  const failed = message.kind === "optimistic" && message.status === "failed";
  const sending = message.kind === "optimistic" && message.status === "sending";

  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine &&
        (otherPartyPhotoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL loaded server-side, not an optimizable remote asset
          <img src={otherPartyPhotoDataUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
        ) : (
          <Avatar seed={otherPartyDisplayName} size="sm" />
        ))}

      <div className="flex max-w-[80%] flex-col gap-1">
        <div
          dir="auto"
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm text-ink [overflow-wrap:anywhere]",
            // Own messages sit flush against the physical right edge with a sharp
            // top-right ("tail") corner; the other party's sit flush left with a
            // sharp top-left corner — this is a deliberate fix (see the WS7 final
            // report): the previous version had this backwards, aligning the
            // viewer's own messages to the physical left in this RTL document.
            mine ? "rounded-tr-sm bg-mint" : "rounded-tl-sm bg-paper",
            failed && "border border-danger bg-danger/10",
            sending && "opacity-60",
          )}
        >
          {message.body}
        </div>
        <div className={cn("flex items-center gap-2 px-1 text-xs text-muted", mine ? "justify-end" : "justify-start")}>
          <span>{formatMessageTime(message.createdAt)}</span>
          {sending && <span>שולח…</span>}
          {failed && (
            <>
              <span className="text-danger">{message.error ?? "שליחה נכשלה"}</span>
              <button type="button" onClick={() => onRetry(message)} className="text-primary underline hover:text-primary-dark">
                ניסיון חוזר
              </button>
              <button type="button" onClick={() => onDiscard(message.clientId)} className="text-muted underline hover:text-danger">
                מחיקה
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConnectionRoom({
  connection,
  currentUserId,
  hasGoogleMeetConnected,
}: {
  connection: ConnectionDetail;
  currentUserId: string;
  hasGoogleMeetConnected: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [messageText, setMessageText] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportCategory, setReportCategory] = useState("OTHER");
  const [reportDescription, setReportDescription] = useState("");
  const [moreOptionsError, setMoreOptionsError] = useState<string | null>(null);

  const isActive = connection.status === "ACTIVE";

  // Double-submit protection (backlog item 13.9): `disabled={pending}` on the
  // submit button covers the normal case, but React only disables the DOM
  // element on the next render/commit — two clicks that both fire before
  // that commit (a fast double-click) can otherwise both dispatch. This ref
  // closes that gap synchronously, independent of render timing.
  const sendInFlightRef = useRef(false);

  // Scroll behavior (backlog item 13.10): only auto-scroll to the newest
  // message when the reader was already near the bottom, or when the jump is
  // caused by their own send — never yank someone reading older history down
  // just because router.refresh() re-rendered the route for an unrelated
  // reason (a meet-link update, a report submission, etc.).
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const justSentRef = useRef(false);

  const displayMessages: DisplayMessage[] = [
    ...connection.messages.map((m) => ({ kind: "sent" as const, ...m })),
    ...optimisticMessages.map((m) => ({ kind: "optimistic" as const, ...m })),
  ];

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (nearBottomRef.current || justSentRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    justSentRef.current = false;
    // Only the message count should drive auto-scroll — re-running this on
    // every render (e.g. while typing) would fight the reader's own scroll position.
  }, [displayMessages.length]);

  function submitBody(body: string, clientId: string) {
    startTransition(async () => {
      try {
        const result = await sendMessageAction(connection.id, body);
        if (!result.ok) {
          setOptimisticMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: "failed", error: result.error } : m)));
          return;
        }
        router.refresh();
        setOptimisticMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      } finally {
        sendInFlightRef.current = false;
      }
    });
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (sendInFlightRef.current) return;
    const body = messageText.trim();
    if (!body) return;

    sendInFlightRef.current = true;
    justSentRef.current = true;
    const clientId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setOptimisticMessages((prev) => [...prev, { clientId, body, createdAt: new Date(), status: "sending" }]);
    setMessageText("");
    submitBody(body, clientId);
  }

  function retrySend(m: OptimisticMessage) {
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    justSentRef.current = true;
    setOptimisticMessages((prev) => prev.map((om) => (om.clientId === m.clientId ? { ...om, status: "sending", error: undefined } : om)));
    submitBody(m.body, m.clientId);
  }

  function discardFailed(clientId: string) {
    setOptimisticMessages((prev) => prev.filter((m) => m.clientId !== clientId));
  }

  function handleMarkCompleted() {
    setMoreOptionsError(null);
    startTransition(async () => {
      const result = await markMeetingAction({ connectionId: connection.id, completedAt: new Date().toISOString() });
      if (!result.ok) {
        setMoreOptionsError(result.error ?? "משהו השתבש");
        return;
      }
      router.refresh();
    });
  }

  function handleEnd() {
    setMoreOptionsError(null);
    startTransition(async () => {
      const result = await endConnectionAction(connection.id);
      if (!result.ok) {
        setMoreOptionsError(result.error ?? "משהו השתבש");
        return;
      }
      router.refresh();
    });
  }

  function handleBlock() {
    setMoreOptionsError(null);
    startTransition(async () => {
      const result = await blockConnectionAction(connection.id);
      if (!result.ok) {
        setMoreOptionsError(result.error ?? "משהו השתבש");
        return;
      }
      router.refresh();
    });
  }

  function submitReport() {
    setMoreOptionsError(null);
    startTransition(async () => {
      const result = await reportConnectionAction({ connectionId: connection.id, category: reportCategory, description: reportDescription });
      if (!result.ok) {
        setMoreOptionsError(result.error ?? "משהו השתבש");
        return;
      }
      setShowReport(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-start gap-4">
          {connection.otherPartyPhotoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL loaded server-side, not an optimizable remote asset
            <img src={connection.otherPartyPhotoDataUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
          ) : (
            <Avatar seed={connection.otherPartyDisplayName} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-ink">
              {connection.otherParty.fullName ?? <span className="font-normal italic text-muted">שם מלא לא סופק</span>}
            </p>
            {connection.otherParty.currentRoleTitle && <p className="mt-1 text-sm text-muted">{connection.otherParty.currentRoleTitle}</p>}
            {(connection.otherParty.cvVerified || connection.otherPartyPublishedInterviewCount > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {connection.otherParty.cvVerified && <CvVerifiedBadge />}
                <InterviewContributorBadge count={connection.otherPartyPublishedInterviewCount} />
              </div>
            )}
            <p className="mt-2 text-sm text-muted">
              {connection.otherParty.company ?? "מעסיק לא צוין"}
              {[connection.otherParty.professionalField, connection.otherParty.seniorityBand].filter(Boolean).length > 0 && (
                <> · {[connection.otherParty.professionalField, connection.otherParty.seniorityBand].filter(Boolean).join(" · ")}</>
              )}
              {typeof connection.otherParty.yearsOfExperience === "number" && (
                <> · {connection.otherParty.yearsOfExperience} שנות ניסיון</>
              )}
            </p>
            {connection.otherParty.shortIntro && <p className="mt-2 text-sm text-ink/80">{connection.otherParty.shortIntro}</p>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {connection.otherParty.linkedInUrl ? (
            <a
              href={connection.otherParty.linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              פרופיל LinkedIn ↗
            </a>
          ) : (
            <span className="text-sm text-muted">קישור LinkedIn לא סופק</span>
          )}
          {connection.otherParty.email ? (
            <span className="text-sm text-muted">{connection.otherParty.email}</span>
          ) : (
            <span className="text-sm text-muted">אימייל לא שותף</span>
          )}
          <span dir="ltr" className="text-sm text-muted">
            {connection.otherParty.phoneNumber ?? "מספר טלפון לא שותף"}
          </span>
        </div>
      </div>



      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 id="conversation" className="font-semibold text-ink">שיחה</h2>
          {pending && (
            <span className="text-xs text-muted" aria-live="polite">
              מעדכן…
            </span>
          )}
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className="mt-4 max-h-80 space-y-3 overflow-y-auto scroll-smooth">
          {displayMessages.length === 0 ? (
            <p className="text-sm text-muted">
              עדיין אין הודעות בשיחה הזו. אפשר לפתוח בהיכרות קצרה — למשל לספר קצת על מה שכל אחד מכם מחפש.
            </p>
          ) : (
            displayMessages.map((m) => {
              const mine = m.kind === "optimistic" ? true : m.senderId === currentUserId;
              const key = m.kind === "optimistic" ? m.clientId : m.id;
              return (
                <MessageBubble
                  key={key}
                  message={m}
                  mine={mine}
                  otherPartyDisplayName={connection.otherPartyDisplayName}
                  otherPartyPhotoDataUrl={connection.otherPartyPhotoDataUrl}
                  onRetry={retrySend}
                  onDiscard={discardFailed}
                />
              );
            })
          )}
        </div>

        {isActive && (
          <form onSubmit={handleSend} className="mt-4 flex gap-2">
            <label htmlFor="chat-message-input" className="sr-only">
              כתיבת הודעה
            </label>
            <input
              id="chat-message-input"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="הודעה…"
              aria-label="כתיבת הודעה"
              disabled={pending}
              className="min-w-0 flex-1 rounded-xl border border-border bg-white px-4 py-2 disabled:opacity-50"
            />
            <Button type="submit" disabled={pending || !messageText.trim()} className="px-4 py-2 text-sm">
              שליחה
            </Button>
          </form>
        )}
      </div>

      <SharedPracticePanel connectionId={connection.id} practice={connection.practice} userId={currentUserId} active={isActive} />

      {isActive && (
        <MeetLinkPanel connectionId={connection.id} meetLink={connection.meetLink} hasGoogleMeetConnected={hasGoogleMeetConnected} />
      )}

      {isActive && (
        <div>
          <button
            type="button"
            onClick={() => setShowMoreOptions((v) => !v)}
            className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:text-ink"
          >
            {showMoreOptions ? "סגירת אפשרויות נוספות" : "אפשרויות נוספות"}
          </button>

          {showMoreOptions && (
            <div className="mt-3 rounded-2xl border border-border bg-white p-6">
              {moreOptionsError && (
                <p role="alert" className="mb-3 text-sm text-danger">
                  {moreOptionsError}
                </p>
              )}
              <h2 className="font-semibold text-ink">סימון מפגש שהתקיים</h2>
              <div className="mt-3 space-y-2 text-sm text-muted">
                {connection.meetingStatuses.length === 0 && <p>עדיין לא סומן מפגש.</p>}
                {connection.meetingStatuses.map((m) => (
                  <p key={m.id}>{m.completedAt ? `הושלם ב-${new Date(m.completedAt).toLocaleDateString("he-IL")}` : "מתוכנן"}</p>
                ))}
              </div>
              <Button variant="secondary" onClick={handleMarkCompleted} disabled={pending} className="mt-3 px-4 py-2 text-sm">
                סימון מפגש כהושלם
              </Button>

              <h2 className="mt-6 font-semibold text-ink">ניהול החיבור</h2>
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
                  className="px-3 py-2 text-sm text-muted hover:text-danger"
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
      )}
    </div>
  );
}
