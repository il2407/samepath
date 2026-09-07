"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/Button";
import { Avatar } from "@/shared/ui/Avatar";
import { CvVerifiedBadge } from "@/shared/ui/CvVerifiedBadge";
import { cn } from "@/shared/ui/cn";
import {
  acceptMeetingProposalAction,
  attachMeetLinkAction,
  blockConnectionAction,
  clearConnectionGuideAction,
  counterProposeMeetingAction,
  declineMeetingProposalAction,
  endConnectionAction,
  markMeetingAction,
  pickGuideForConnectionAction,
  proposeMeetingAction,
  reportConnectionAction,
  sendMessageAction,
  setMySessionTypesAction,
} from "@/modules/connections/actions";
import { connectionReasonLabels, reportCategoryLabels, sessionTypeReasons } from "@/modules/profiles/labels";
import type { ConnectionDetail, MeetingProposalDetail } from "@/modules/connections/service";
import type { ConnectionReason } from "@/generated/prisma/client";

const roleLabels: Record<string, string> = { PRESENTER: "מציג/ה", LISTENER: "מקשיב/ה", BOTH: "שניכם" };

/** The ConnectionReason that maps to the "intro" practice-session guide category (see prisma/seed/guides.ts) — picking it as a session type auto-suggests that guide, so the pair doesn't need a second click to see the intro structure. Also the "preferred first step" default for a meeting proposal (backlog item 14.3). */
const INTRO_SESSION_TYPE: ConnectionReason = "INTRO_VIDEO_CALL";
const INTRO_GUIDE_CATEGORY = "intro";

function SessionTypeSelector({
  connectionId,
  mySessionTypes,
  otherPartySessionTypes,
  hasSelectedGuide,
}: {
  connectionId: string;
  mySessionTypes: string[];
  otherPartySessionTypes: string[];
  hasSelectedGuide: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(mySessionTypes);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(value: string) {
    const wasAdded = !selected.includes(value);
    const next = wasAdded ? [...selected, value] : selected.filter((v) => v !== value);
    setSelected(next);
    setError(null);
    startTransition(async () => {
      const result = await setMySessionTypesAction({ connectionId, sessionTypes: next });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      if (wasAdded && value === INTRO_SESSION_TYPE && !hasSelectedGuide) {
        await pickGuideForConnectionAction({ connectionId, category: INTRO_GUIDE_CATEGORY });
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <h2 className="font-semibold text-ink">איזה סוג מפגש תרצו הפעם?</h2>
      <p className="mt-1 text-sm text-muted">
        כל צד מסמן בנפרד — כדי ששניכם תדעו מראש למה לצפות. אין צורך בהסכמה הדדית.
      </p>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {sessionTypeReasons.map((value) => (
          <button
            key={value}
            type="button"
            disabled={pending}
            onClick={() => toggle(value)}
            aria-pressed={selected.includes(value)}
            className={
              selected.includes(value)
                ? "rounded-full border border-primary bg-mint px-4 py-2 text-sm text-primary-dark disabled:opacity-50"
                : "rounded-full border border-border bg-white px-4 py-2 text-sm text-ink hover:border-primary disabled:opacity-50"
            }
          >
            {connectionReasonLabels[value]}
          </button>
        ))}
      </div>

      {otherPartySessionTypes.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          הצד השני מעוניין/ת ב: {otherPartySessionTypes.map((r) => connectionReasonLabels[r] ?? r).join(", ")}
        </p>
      )}
    </div>
  );
}

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

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

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
            <button type="button" disabled={pending} onClick={clear} className="text-muted hover:text-danger">
              הסרת המבנה המוצע
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting proposals (backlog item 14) — propose / accept / decline /
// counter-propose, plus attaching a manually-pasted, backend-validated
// Google Meet link. No real Calendar/Meet API integration — see
// src/modules/connections/meeting-link.ts and the README.
// ---------------------------------------------------------------------------

const MEETING_PROPOSAL_STATUS_LABELS: Record<string, string> = {
  PROPOSED: "ממתינה לתשובה",
  ACCEPTED: "אושרה",
  DECLINED: "נדחתה",
  COUNTER_PROPOSED: "הוחלפה בהצעה נגדית",
};

/** Formats a proposal's scheduledAt in the *viewer's own* configured timezone — display-side formatting only, never cross-timezone conversion (see schema.prisma's MeetingProposal doc comment). */
function formatScheduledAt(scheduledAt: Date | string, timezone: string): string {
  const date = new Date(scheduledAt);
  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(date);
  } catch {
    // An invalid/unrecognized IANA zone string shouldn't ever crash the room — fall back to the browser's own zone.
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
}

/**
 * A `<input type="datetime-local">` value has no timezone of its own — the
 * browser (and `new Date(value)`) treats it as this device's own local
 * wall-clock time, which for the person filling in the form *is* their own
 * local time. That's exactly what we want to store (as a real UTC instant,
 * Prisma's default) with zero extra conversion logic; see the
 * `MeetingProposal` schema doc comment for why nothing more elaborate than
 * this + display-side formatting was attempted.
 */
function localDateTimeInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function ProposalForm({
  connectionId,
  mode,
  counterTargetId,
  onDone,
}: {
  connectionId: string;
  mode: "propose" | "counter";
  counterTargetId?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sessionType, setSessionType] = useState<string>(INTRO_SESSION_TYPE);
  const [meetLink, setMeetLink] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idPrefix = mode === "counter" ? "counter" : "propose";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        connectionId,
        sessionType: sessionType as ConnectionReason,
        meetLink: meetLink.trim() || undefined,
        scheduledAt: localDateTimeInputToIso(scheduledAt),
      };
      const result =
        mode === "counter"
          ? await counterProposeMeetingAction({ ...payload, proposalId: counterTargetId! })
          : await proposeMeetingAction(payload);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-border bg-white p-4">
      <div>
        <label htmlFor={`${idPrefix}-session-type`} className="block text-sm font-medium text-ink">
          סוג המפגש
        </label>
        <select
          id={`${idPrefix}-session-type`}
          value={sessionType}
          onChange={(e) => setSessionType(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          {sessionTypeReasons.map((r) => (
            <option key={r} value={r}>
              {connectionReasonLabels[r]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-meet-link`} className="block text-sm font-medium text-ink">
          קישור ל-Google Meet (אופציונלי)
        </label>
        <input
          id={`${idPrefix}-meet-link`}
          type="url"
          dir="ltr"
          value={meetLink}
          onChange={(e) => setMeetLink(e.target.value)}
          placeholder="https://meet.google.com/abc-defg-hij"
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-scheduled-at`} className="block text-sm font-medium text-ink">
          מועד מוצע (אופציונלי, לפי השעון המקומי שלכם)
        </label>
        <input
          id={`${idPrefix}-scheduled-at`}
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="px-4 py-2 text-sm">
          {mode === "counter" ? "שליחת הצעה נגדית" : "שליחת הצעה"}
        </Button>
        <button type="button" onClick={onDone} disabled={pending} className="px-3 py-2 text-sm text-muted hover:text-ink">
          ביטול
        </button>
      </div>
    </form>
  );
}

function MeetingProposalPanel({
  connectionId,
  currentUserId,
  proposals,
  myTimezone,
}: {
  connectionId: string;
  currentUserId: string;
  proposals: MeetingProposalDetail[];
  myTimezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");

  const latest = proposals[0] ?? null;
  const isOpen = latest?.status === "PROPOSED";
  const iAmProposer = latest?.proposedByUserId === currentUserId;
  const history = proposals.slice(1);

  function respond(action: "accept" | "decline") {
    if (!latest) return;
    setError(null);
    startTransition(async () => {
      const result =
        action === "accept"
          ? await acceptMeetingProposalAction({ connectionId, proposalId: latest.id })
          : await declineMeetingProposalAction({ connectionId, proposalId: latest.id });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setShowCounterForm(false);
      router.refresh();
    });
  }

  function quickProposeIntro() {
    setError(null);
    startTransition(async () => {
      const result = await proposeMeetingAction({ connectionId, sessionType: INTRO_SESSION_TYPE });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      router.refresh();
    });
  }

  function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!latest || !linkDraft.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await attachMeetLinkAction({ connectionId, proposalId: latest.id, meetLink: linkDraft });
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
      <h2 className="font-semibold text-ink">תיאום מפגש</h2>
      <p className="mt-1 text-sm text-muted">
        הצעה, אישור, דחייה או הצעה נגדית לזמן ולפורמט של המפגש הבא — כולל אפשרות לצרף קישור קיים ל-Google Meet. אין
        יצירה אוטומטית של אירוע ביומן.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {latest && (
        <div className="mt-4 rounded-xl border border-border bg-paper p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">
              {isOpen
                ? iAmProposer
                  ? "ההצעה שלכם ממתינה לתשובת הצד השני"
                  : "יש הצעת מפגש חדשה — ממתינה לתשובתכם"
                : MEETING_PROPOSAL_STATUS_LABELS[latest.status] ?? latest.status}
            </p>
            {latest.sessionType && (
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs text-muted">
                {connectionReasonLabels[latest.sessionType] ?? latest.sessionType}
              </span>
            )}
          </div>

          {latest.scheduledAt && <p className="mt-2 text-sm text-muted">מועד מוצע: {formatScheduledAt(latest.scheduledAt, myTimezone)}</p>}

          {latest.meetLink && (
            <p className="mt-2 text-sm text-muted">
              קישור:{" "}
              <a href={latest.meetLink} target="_blank" rel="noreferrer" dir="ltr" className="break-all text-primary underline">
                {latest.meetLink}
              </a>
            </p>
          )}

          {isOpen &&
            (!iAmProposer ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={pending} onClick={() => respond("accept")} className="px-4 py-2 text-sm">
                  אישור ההצעה
                </Button>
                <Button variant="secondary" disabled={pending} onClick={() => respond("decline")} className="px-4 py-2 text-sm">
                  דחייה
                </Button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setShowCounterForm((v) => !v)}
                  className="px-3 py-2 text-sm text-primary hover:text-primary-dark"
                >
                  {showCounterForm ? "סגירה" : "הצעה נגדית…"}
                </button>
              </div>
            ) : (
              <button type="button" disabled={pending} onClick={() => respond("decline")} className="mt-3 text-sm text-muted hover:text-danger">
                ביטול ההצעה
              </button>
            ))}

          {showCounterForm && isOpen && !iAmProposer && (
            <ProposalForm connectionId={connectionId} mode="counter" counterTargetId={latest.id} onDone={() => setShowCounterForm(false)} />
          )}

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
              placeholder={latest.meetLink ? "עדכון קישור ל-Google Meet" : "הוספת קישור ל-Google Meet"}
              className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
            <Button type="submit" variant="secondary" disabled={pending || !linkDraft.trim()} className="px-3 py-2 text-sm">
              שמירה
            </Button>
          </form>
        </div>
      )}

      {(!latest || !isOpen) && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={pending} onClick={quickProposeIntro} className="px-4 py-2 text-sm">
              הצעת פגישת היכרות בווידאו
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowProposeForm((v) => !v)}
              className="px-3 py-2 text-sm text-primary hover:text-primary-dark"
            >
              {showProposeForm ? "סגירה" : "הצעה מותאמת אישית…"}
            </button>
          </div>
          {showProposeForm && <ProposalForm connectionId={connectionId} mode="propose" onDone={() => setShowProposeForm(false)} />}
        </div>
      )}

      {history.length > 0 && (
        <details className="mt-4 text-sm text-muted">
          <summary className="cursor-pointer">היסטוריית הצעות קודמות ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((p) => (
              <li key={p.id}>
                {MEETING_PROPOSAL_STATUS_LABELS[p.status] ?? p.status}
                {p.sessionType && ` · ${connectionReasonLabels[p.sessionType] ?? p.sessionType}`}
              </li>
            ))}
          </ul>
        </details>
      )}
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
  meetingProposals,
  currentUserId,
  categories,
}: {
  connection: ConnectionDetail;
  meetingProposals: MeetingProposalDetail[];
  currentUserId: string;
  categories: readonly { slug: string; labelHe: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [messageText, setMessageText] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [reportCategory, setReportCategory] = useState("OTHER");
  const [reportDescription, setReportDescription] = useState("");

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
  // reason (a session-type pick, a meeting response, etc.).
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
          {connection.otherPartyPhotoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL loaded server-side, not an optimizable remote asset
            <img src={connection.otherPartyPhotoDataUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
          ) : (
            <Avatar seed={connection.otherPartyDisplayName} />
          )}
          <div>
            <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
              {connection.otherPartyDisplayName}
              {connection.otherParty.cvVerified && <CvVerifiedBadge />}
            </p>
            <p className="text-sm text-muted">
              {[connection.otherParty.professionalField, connection.otherParty.seniorityBand].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
          {connection.otherParty.email && <span>{connection.otherParty.email}</span>}
          {connection.otherParty.phoneNumber && <span dir="ltr">{connection.otherParty.phoneNumber}</span>}
        </div>
      </div>

      {isActive && (
        <SessionTypeSelector
          connectionId={connection.id}
          mySessionTypes={connection.mySessionTypes}
          otherPartySessionTypes={connection.otherPartySessionTypes}
          hasSelectedGuide={connection.selectedGuide !== null}
        />
      )}

      {isActive && <SuggestedSession connectionId={connection.id} selectedGuide={connection.selectedGuide} categories={categories} />}

      {isActive && (
        <MeetingProposalPanel
          connectionId={connection.id}
          currentUserId={currentUserId}
          proposals={meetingProposals}
          myTimezone={connection.myTimezone}
        />
      )}

      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">שיחה</h2>
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
              className="flex-1 rounded-xl border border-border bg-white px-4 py-2 disabled:opacity-50"
            />
            <Button type="submit" disabled={pending || !messageText.trim()} className="px-4 py-2 text-sm">
              שליחה
            </Button>
          </form>
        )}
      </div>

      {isActive && (
        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="font-semibold text-ink">סימון מפגש שהתקיים</h2>
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
  );
}
