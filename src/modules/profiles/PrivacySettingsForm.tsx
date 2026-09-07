"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CompanyPicker, type CompanySelection } from "@/modules/companies/CompanyPicker";
import { Button } from "@/shared/ui/Button";
import { updatePrivacySettingsAction } from "@/modules/profiles/actions";
import { ProfilePhotoUploadCard } from "@/modules/profiles/ProfilePhotoUploadCard";

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

export interface PrivacySettingsInitial {
  blockEntireCorporateGroup: boolean;
  blockedCompanies: { company: CompanySelection; reason: BlockReason }[];
  fullName: string;
  shareCompanyPreMatch: boolean;
  shareFullNamePostMatch: boolean;
  photoDataUrl: string | null;
  sharePhotoPostMatch: boolean;
  shareLinkedInPostMatch: boolean;
  linkedInUrl: string;
  sharePreciseLocationPostMatch: boolean;
  shareEmailPostMatch: boolean;
  sharePhonePostMatch: boolean;
  phoneNumber: string;
  resumeRetentionPreference: "DELETE_AFTER_CONFIRMATION" | "KEEP";
}

export function PrivacySettingsForm({ initial }: { initial: PrivacySettingsInitial }) {
  const router = useRouter();
  const [blockGroup, setBlockGroup] = useState(initial.blockEntireCorporateGroup);
  const [blocks, setBlocks] = useState<BlockedCompanyRow[]>(
    initial.blockedCompanies.map((b) => ({ key: crypto.randomUUID(), company: b.company, reason: b.reason, note: "" })),
  );
  const [fullName, setFullName] = useState(initial.fullName);
  const [shareCompanyPreMatch, setShareCompanyPreMatch] = useState(initial.shareCompanyPreMatch);
  const [shareFullName, setShareFullName] = useState(initial.shareFullNamePostMatch);
  const [sharePhoto, setSharePhoto] = useState(initial.sharePhotoPostMatch);
  const [shareLinkedIn, setShareLinkedIn] = useState(initial.shareLinkedInPostMatch);
  const [linkedInUrl, setLinkedInUrl] = useState(initial.linkedInUrl);
  const [shareLocation, setShareLocation] = useState(initial.sharePreciseLocationPostMatch);
  const [shareEmail, setShareEmail] = useState(initial.shareEmailPostMatch);
  const [sharePhone, setSharePhone] = useState(initial.sharePhonePostMatch);
  const [phoneNumber, setPhoneNumber] = useState(initial.phoneNumber);
  const [resumeRetention, setResumeRetention] = useState(initial.resumeRetentionPreference);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    setNotice(null);
    if (shareFullName && !fullName.trim()) return setError("יש להזין שם מלא כדי לחשוף אותו");
    for (const b of blocks) {
      if (!b.company) return setError("יש לבחור חברה עבור כל שורת חסימה, או להסיר שורה ריקה");
    }

    startTransition(async () => {
      const result = await updatePrivacySettingsAction({
        blockEntireCorporateGroup: blockGroup,
        additionalBlockedCompanies: blocks.map((b) => ({ companyId: b.company!.id, reason: b.reason })),
        fullName: fullName.trim() || undefined,
        shareCompanyPreMatch,
        shareFullNamePostMatch: shareFullName,
        sharePhotoPostMatch: sharePhoto,
        shareLinkedInPostMatch: shareLinkedIn,
        linkedInUrl: shareLinkedIn ? linkedInUrl.trim() || undefined : undefined,
        sharePreciseLocationPostMatch: shareLocation,
        shareEmailPostMatch: shareEmail,
        sharePhonePostMatch: sharePhone,
        phoneNumber: sharePhone ? phoneNumber.trim() || undefined : undefined,
        resumeRetentionPreference: resumeRetention,
      });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setNotice("ההגדרות נשמרו");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <section className="space-y-3">
        <h2 className="font-semibold text-ink">חסימת קבוצת חברות</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" checked={blockGroup} onChange={(e) => setBlockGroup(e.target.checked)} className="size-4" />
          לחסום את כל קבוצת החברות של המעסיק הנוכחי שלי
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">חברות חסומות</h2>
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
        <p className="text-sm text-muted">
          שם מלא ותמונה לעולם לא מוצגים לפני אישור הדדי. במקומם, המערכת מציגה אתכם עם כינוי ואייקון
          אקראיים — בדיוק כמו משתמש/ת אנונימי/ת בגיליון גוגל משותף. אי אפשר לבחור אותם, וזה מכוון: כך
          הזהות שלכם לא נחשפת בטעות. הכינוי משתנה עם כל הצעת התאמה חדשה.
        </p>
        <div className="rounded-xl border border-border bg-paper p-4">
          <ToggleRow label="להציג גם את שם המעסיק לפני אישור הדדי" checked={shareCompanyPreMatch} onChange={setShareCompanyPreMatch} />
          <p className="mt-1.5 text-xs text-muted">
            כברירת מחדל שם המעסיק מוצג רק לאחר אישור הדדי. אם תסמנו זאת, הוא יופיע כבר בכרטיס ההצעה —
            שימושי כדי לסנן מראש חברה שפתאום הבנתם שאתם לא רוצים בה, גם אם לא חסמתם אותה מראש. מכיוון
            שההתאמה כבר עברה את בדיקת הפרטיות, זה לעולם לא יחשוף חברה שכבר נפסלה — אבל עדיין חושף יותר
            מידע לפני שהצד השני הסכים לכך.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">מה לחשוף אחרי אישור הדדי</h2>
        <ProfilePhotoUploadCard
          currentPhotoDataUrl={initial.photoDataUrl}
          avatarFallbackSeed={fullName || "SamePath"}
          onUploaded={() => setSharePhoto(true)}
          onRemoved={() => setSharePhoto(false)}
        />
        {initial.photoDataUrl && <ToggleRow label="להציג את התמונה לאחר אישור הדדי" checked={sharePhoto} onChange={setSharePhoto} />}
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
              dir="ltr"
              className="mt-2 w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">שמירת קורות חיים</h2>
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

      {notice && <p className="rounded-xl bg-mint px-4 py-3 text-sm text-primary-dark">{notice}</p>}
      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "שומר…" : "שמירת שינויים"}
      </Button>
    </form>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4" />
      {label}
    </label>
  );
}
