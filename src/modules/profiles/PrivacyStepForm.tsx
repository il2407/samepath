"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CompanyPicker, type CompanySelection } from "@/modules/companies/CompanyPicker";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { completePrivacyOnboardingAction } from "@/modules/profiles/actions";

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

export function PrivacyStepForm({ currentCompanyName }: { currentCompanyName: string | null }) {
  const [employerConfirmed, setEmployerConfirmed] = useState(false);
  const [blockGroup, setBlockGroup] = useState(true);
  const [blocks, setBlocks] = useState<BlockedCompanyRow[]>([]);

  const [displayMode, setDisplayMode] = useState<"ALIAS" | "FIRST_NAME">("ALIAS");
  const [aliasText, setAliasText] = useState("");
  const [firstName, setFirstName] = useState("");

  const [shareLinkedIn, setShareLinkedIn] = useState(false);
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [shareLocation, setShareLocation] = useState(false);
  const [shareEmail, setShareEmail] = useState(false);
  const [sharePhone, setSharePhone] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shareFullName, setShareFullName] = useState(false);
  const [fullName, setFullName] = useState("");

  const [resumeRetention, setResumeRetention] = useState<"DELETE_AFTER_CONFIRMATION" | "KEEP">(
    "DELETE_AFTER_CONFIRMATION",
  );

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

    if (!employerConfirmed) return setError("יש לאשר את המעסיק הנוכחי כדי להמשיך");
    if (displayMode === "ALIAS" && !aliasText.trim()) return setError("יש להזין כינוי להצגה");
    if (displayMode === "FIRST_NAME" && !firstName.trim()) return setError("יש להזין שם פרטי");
    for (const b of blocks) {
      if (!b.company) return setError("יש לבחור חברה עבור כל שורת חסימה, או להסיר שורה ריקה");
    }
    if (shareFullName && !fullName.trim()) return setError("יש להזין שם מלא כדי לחשוף אותו לאחר אישור הדדי");

    startTransition(async () => {
      const result = await completePrivacyOnboardingAction({
        employerConfirmed,
        blockEntireCorporateGroup: blockGroup,
        additionalBlockedCompanies: blocks.map((b) => ({
          companyId: b.company!.id,
          reason: b.reason,
          note: b.note.trim() || undefined,
        })),
        preMatchDisplayMode: displayMode,
        aliasText: displayMode === "ALIAS" ? aliasText.trim() : undefined,
        firstName: displayMode === "FIRST_NAME" ? firstName.trim() : undefined,
        fullName: fullName.trim() || undefined,
        shareFullNamePostMatch: shareFullName,
        sharePhotoPostMatch: false,
        shareLinkedInPostMatch: shareLinkedIn,
        linkedInUrl: shareLinkedIn ? linkedInUrl.trim() || undefined : undefined,
        sharePreciseLocationPostMatch: shareLocation,
        shareEmailPostMatch: shareEmail,
        sharePhonePostMatch: sharePhone,
        phoneNumber: sharePhone ? phoneNumber.trim() || undefined : undefined,
        resumeRetentionPreference: resumeRetention,
      });
      if (result && !result.ok) setError(result.error ?? "משהו השתבש. נסו שוב");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <section className="space-y-3 rounded-2xl border border-border bg-mint p-5">
        <h2 className="font-semibold text-ink">אישור מעסיק נוכחי</h2>
        {currentCompanyName ? (
          <p className="text-sm text-ink">
            החברה הנוכחית שהזנתם: <strong>{currentCompanyName}</strong>
          </p>
        ) : (
          <p className="text-sm text-ink">לא הוזנה חברה נוכחית בשלב הקודם.</p>
        )}
        <p className="text-sm text-muted">
          אישור זה נדרש לפני הפעלת הפרופיל, כדי שנוכל למנוע התאמה עם עמיתים לעבודה. השם אינו מוצג
          לאף אחד — הוא משמש רק לבדיקת פרטיות פנימית.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={employerConfirmed}
            onChange={(e) => setEmployerConfirmed(e.target.checked)}
            className="size-4"
          />
          כן, זהו המעסיק הנוכחי שלי
        </label>
        <Link href="/app/onboarding/profile" className="inline-block text-sm text-primary hover:text-primary-dark">
          זה לא נכון — חזרה לעריכת הפרופיל
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">חסימת קבוצת חברות</h2>
        <p className="text-sm text-muted">
          אם החברה הנוכחית שלכם היא חלק מקבוצת חברות (למשל חברת אם או חברות בנות), נחסום גם אותן —
          ברירת המחדל הבטוחה. אפשר לבטל אם ידוע לכם שאין בכך צורך.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" checked={blockGroup} onChange={(e) => setBlockGroup(e.target.checked)} className="size-4" />
          לחסום את כל קבוצת החברות
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">חברות נוספות לחסימה</h2>
        <p className="text-sm text-muted">
          מעסיק לשעבר, חברה שבה אתם בתהליך ריאיון, לקוח, ספק, או כל חברה אחרת שתבחרו — לא תוצגו להם
          ולא תוצגו בפניהם, בלי שום הסבר גלוי.
        </p>
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
            <button type="button" onClick={() => removeBlock(b.key)} className="text-sm text-muted hover:text-red-600">
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
        <p className="text-sm text-muted">שם מלא ותמונה לעולם לא מוצגים לפני אישור הדדי. בחרו איך תרצו להיקרא עד אז.</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={displayMode === "ALIAS"} onChange={() => setDisplayMode("ALIAS")} />
            כינוי
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={displayMode === "FIRST_NAME"} onChange={() => setDisplayMode("FIRST_NAME")} />
            שם פרטי
          </label>
        </div>
        {displayMode === "ALIAS" ? (
          <input
            value={aliasText}
            onChange={(e) => setAliasText(e.target.value)}
            placeholder='לדוגמה: "מ." או "מפתחת Backend"'
            className="w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
          />
        ) : (
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="שם פרטי"
            className="w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">מה לחשוף אחרי אישור הדדי</h2>
        <p className="text-sm text-muted">
          כל הפרטים הבאים מוסתרים כברירת מחדל. סמנו רק את מה שתרצו לחשוף — ותמיד תוכלו לשנות בהמשך.
        </p>
        <div>
          <ToggleRow label="שם מלא" checked={shareFullName} onChange={setShareFullName} />
          {shareFullName && (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="שם מלא"
              className="mt-2 w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
            />
          )}
        </div>
        <div>
          <ToggleRow label="קישור ל-LinkedIn" checked={shareLinkedIn} onChange={setShareLinkedIn} />
          {shareLinkedIn && (
            <input
              value={linkedInUrl}
              onChange={(e) => setLinkedInUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/..."
              dir="ltr"
              className="mt-2 w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
            />
          )}
        </div>
        <ToggleRow label="מיקום מדויק" checked={shareLocation} onChange={setShareLocation} />
        <ToggleRow label="כתובת אימייל" checked={shareEmail} onChange={setShareEmail} />
        <div>
          <ToggleRow label="מספר טלפון" checked={sharePhone} onChange={setSharePhone} />
          {sharePhone && (
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="050-0000000"
              dir="ltr"
              className="mt-2 w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">שמירת קורות חיים</h2>
        <p className="text-sm text-muted">רלוונטי רק אם תעלו קורות חיים בעתיד. כברירת מחדל הקובץ נמחק לאחר עיבוד ואישור.</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={resumeRetention === "DELETE_AFTER_CONFIRMATION"}
              onChange={() => setResumeRetention("DELETE_AFTER_CONFIRMATION")}
            />
            למחוק אחרי עיבוד
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={resumeRetention === "KEEP"} onChange={() => setResumeRetention("KEEP")} />
            לשמור
          </label>
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "שומר…" : "המשך להעדפות חיבור"}
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
