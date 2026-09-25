"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CompanyPicker, type CompanySelection } from "@/modules/companies/CompanyPicker";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { Avatar } from "@/shared/ui/Avatar";
import { CvVerifiedBadge } from "@/shared/ui/CvVerifiedBadge";
import { completePrivacyOnboardingAction } from "@/modules/profiles/actions";
import { ProfilePhotoUploadCard } from "@/modules/profiles/ProfilePhotoUploadCard";
import {
  connectionCadenceLabels,
  connectionFormatLabels,
  connectionModeLabels,
  connectionReasonLabels,
} from "@/modules/profiles/labels";
import type { PreMatchCandidateDTO } from "@/modules/profiles/dto";

type BlockReason = "FORMER_EMPLOYER" | "INTERVIEWING" | "CLIENT_OR_VENDOR" | "OTHER";

const reasonLabels: Record<BlockReason, string> = {
  FORMER_EMPLOYER: "מעסיק לשעבר",
  INTERVIEWING: "חברה שבה אני בתהליך ריאיון",
  CLIENT_OR_VENDOR: "לקוח או ספק",
  OTHER: "אחר",
};

interface BlockedCompanyRow {
  key: string;
  company: CompanySelection | null;
  reason: BlockReason;
  note: string;
}

export interface PrivacyStepInitial {
  blockedCompanies: { company: CompanySelection; reason: BlockReason }[];
  fullName: string;
  shareCompanyPreMatch: boolean;
  shareFullNamePostMatch: boolean;
  phoneNumber: string;
}

export function PrivacyStepForm({
  currentCompanyName,
  currentPhotoDataUrl,
  initialSharePhotoPostMatch,
  initial,
  submitLabel,
  previewCandidate,
  previewNickname,
}: {
  currentCompanyName: string | null;
  currentPhotoDataUrl: string | null;
  initialSharePhotoPostMatch: boolean;
  /** When re-editing an already-completed privacy step (?edit=true), pre-fills the form from saved data. */
  initial?: PrivacyStepInitial;
  submitLabel?: string;
  /** The candidate's own profile, shaped exactly like what a real match suggestion shows — used to render a live "how you'll appear" preview. Null only if the profile row is somehow missing. */
  previewCandidate: PreMatchCandidateDTO | null;
  /** A stable, per-user stand-in for the random per-suggestion nickname real viewers would see. */
  previewNickname: string;
}) {
  const [blocks, setBlocks] = useState<BlockedCompanyRow[]>(
    initial?.blockedCompanies.map((b) => ({ key: crypto.randomUUID(), company: b.company, reason: b.reason, note: "" })) ?? [],
  );

  const [shareCompanyPreMatch, setShareCompanyPreMatch] = useState(initial?.shareCompanyPreMatch ?? false);

  const [phoneNumber, setPhoneNumber] = useState(initial?.phoneNumber ?? "");
  const [shareFullName, setShareFullName] = useState(initial?.shareFullNamePostMatch ?? false);
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [sharePhoto, setSharePhoto] = useState(initialSharePhotoPostMatch);

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addBlock() {
    setBlocks((rows) => [...rows, { key: crypto.randomUUID(), company: null, reason: "OTHER", note: "" }]);
  }
  function updateBlock(key: string, patch: Partial<BlockedCompanyRow>) {
    setBlocks((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeBlock(key: string) {
    setBlocks((rows) => rows.filter((r) => r.key !== key));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const b of blocks) {
      if (!b.company) return setError("יש לבחור חברה עבור כל שורת חסימה, או להסיר שורה ריקה");
    }
    if (shareFullName && !fullName.trim()) return setError("יש להזין שם מלא כדי לחשוף אותו לאחר אישור הדדי");

    startTransition(async () => {
      const result = await completePrivacyOnboardingAction({
        additionalBlockedCompanies: blocks.map((b) => ({
          companyId: b.company!.id,
          reason: b.reason,
          note: b.note.trim() || undefined,
        })),
        fullName: fullName.trim() || undefined,
        shareCompanyPreMatch,
        shareFullNamePostMatch: shareFullName,
        sharePhotoPostMatch: sharePhoto,
        phoneNumber: phoneNumber.trim() || undefined,
      });
      if (result && !result.ok) setError(result.error ?? "משהו השתבש. נסו שוב");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <Link href="/app/onboarding/profile?edit=true" className="inline-block text-sm text-primary hover:text-primary-dark">
        חזרה לעריכת הפרופיל המקצועי
      </Link>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">חברות שלא יראו אתכם</h2>
        <p className="text-sm text-muted">מעסיק לשעבר, חברה בתהליך ריאיון, לקוח או ספק — לא תוצגו זה לזה.</p>

        {currentCompanyName ? (
          <div className="grid gap-3 rounded-2xl border border-border bg-mint p-4 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <p className="text-sm font-medium text-ink">{currentCompanyName}</p>
              <p className="text-xs text-muted">זוהה אוטומטית כמעסיק הנוכחי</p>
            </div>
            <span className="self-center rounded-lg bg-white px-3 py-3 text-sm text-muted">חסום תמיד</span>
            <span className="self-center px-3 py-2 text-sm text-muted" title="מונע התאמה בטעות עם עמיתים לעבודה">
              לא ניתן להסרה
            </span>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
            לא זוהתה חברה נוכחית — אפשר להוסיף כאן.
          </p>
        )}

        {blocks.map((b) => (
          <div key={b.key} className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[1fr_auto_auto]">
            <CompanyPicker value={b.company} onChange={(c) => updateBlock(b.key, { company: c })} placeholder="שם החברה" />
            <select
              value={b.reason}
              onChange={(e) => updateBlock(b.key, { reason: e.target.value as BlockReason })}
              className="rounded-xl border border-border bg-white px-3 py-3 text-sm"
            >
              {Object.entries(reasonLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => removeBlock(b.key)} className="text-sm text-muted hover:text-danger">
              הסרה
            </button>
          </div>
        ))}
        <button type="button" onClick={addBlock} className="text-sm font-medium text-primary hover:text-primary-dark">
          + הוספת חברה לחסימה
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">איך תוצגו לפני אישור הדדי</h2>
        <p className="text-sm text-muted">כינוי ואייקון אקראיים בלבד — לא שם, לא תמונה.</p>
        <div className="rounded-xl border border-border bg-paper p-4">
          <ToggleRow label="להציג גם את שם המעסיק לפני אישור הדדי" checked={shareCompanyPreMatch} onChange={setShareCompanyPreMatch} />
        </div>

        {previewCandidate && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">כך תופיעו בכרטיס הצעת התאמה:</p>
            <div className="rounded-2xl border border-border bg-white p-6">
              <div className="flex items-center gap-3">
                <Avatar seed={previewNickname} />
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                    {previewNickname}
                    {previewCandidate.cvVerified && <CvVerifiedBadge />}
                  </p>
                  <p className="text-sm text-muted">
                    {[
                      shareCompanyPreMatch ? currentCompanyName : null,
                      previewCandidate.professionalField,
                      previewCandidate.seniorityBand,
                      previewCandidate.yearsOfExperience != null ? `${previewCandidate.yearsOfExperience} שנות ניסיון` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>

              {previewCandidate.targetRoles.length > 0 && (
                <p className="mt-3 text-sm text-ink">מחפש/ת: {previewCandidate.targetRoles.join(", ")}</p>
              )}

              {previewCandidate.shortIntro && (
                <p className="mt-3 text-sm italic text-ink/80">&quot;{previewCandidate.shortIntro}&quot;</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                <Tag label={connectionFormatLabels[previewCandidate.connectionFormat]} />
                <Tag label={connectionCadenceLabels[previewCandidate.connectionCadence]} />
                <Tag label={connectionModeLabels[previewCandidate.connectionMode]} />
                {previewCandidate.reasons.map((r) => (
                  <Tag key={r} label={connectionReasonLabels[r]} />
                ))}
              </div>

              {previewCandidate.availabilitySummary.length > 0 && (
                <p className="mt-3 text-xs text-muted">זמינות: {previewCandidate.availabilitySummary.join(", ")}</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">מה נחשף לאחר חיבור פעיל</h2>
        <p className="text-sm text-muted">
          שם מלא, מיקום וקישור LinkedIn נחשפים אוטומטית. אימייל וטלפון אינם נחשפים
          אוטומטית — אפשר לאפשר זאת בהמשך, בכל שלב שתרצו, מתוך הגדרות הפרטיות.
        </p>
        <ProfilePhotoUploadCard
          currentPhotoDataUrl={currentPhotoDataUrl}
          avatarFallbackSeed={fullName || "SamePath"}
          onUploaded={() => setSharePhoto(true)}
          onRemoved={() => setSharePhoto(false)}
        />
        {currentPhotoDataUrl && <ToggleRow label="להציג את התמונה לאחר אישור הדדי" checked={sharePhoto} onChange={setSharePhoto} />}
        <div className="rounded-xl border border-border bg-paper p-4">
          <label className="block text-sm font-medium text-ink">שם מלא</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="שם מלא"
            className="mt-2 w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
          />
          <div className="mt-3">
            <ToggleRow label="לחשוף שם פרטי כבר בהתאמה הדדית" checked={shareFullName} onChange={setShareFullName} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">מספר טלפון (אופציונלי)</label>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="050-0000000"
            dir="ltr"
            className="mt-2 w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
          />
        </div>
      </section>

      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "שומר…" : (submitLabel ?? "המשך להעדפות חיבור")}
      </Button>
    </form>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex items-center gap-2 text-sm text-ink")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4" />
      {label}
    </label>
  );
}

function Tag({ label }: { label?: string }) {
  if (!label) return null;
  return <span className={cn("rounded-full bg-paper px-2.5 py-1")}>{label}</span>;
}
