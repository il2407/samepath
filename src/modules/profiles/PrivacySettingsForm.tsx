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
  blockedCompanies: { company: CompanySelection; reason: BlockReason }[];
  fullName: string;
  shareCompanyPreMatch: boolean;
  shareFullNamePostMatch: boolean;
  photoDataUrl: string | null;
  sharePhotoPostMatch: boolean;
  phoneNumber: string;
  /** The account's login email — display-only here, never user-typed. */
  email: string;
  shareEmailPostMatch: boolean;
  sharePhonePostMatch: boolean;
}

export function PrivacySettingsForm({
  initial,
  currentCompanyName,
}: {
  initial: PrivacySettingsInitial;
  currentCompanyName: string | null;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockedCompanyRow[]>(
    initial.blockedCompanies.map((b) => ({ key: crypto.randomUUID(), company: b.company, reason: b.reason, note: "" })),
  );
  const [fullName, setFullName] = useState(initial.fullName);
  const [shareCompanyPreMatch, setShareCompanyPreMatch] = useState(initial.shareCompanyPreMatch);
  const [shareFullName, setShareFullName] = useState(initial.shareFullNamePostMatch);
  const [sharePhoto, setSharePhoto] = useState(initial.sharePhotoPostMatch);
  const [phoneNumber, setPhoneNumber] = useState(initial.phoneNumber);
  const [shareEmail, setShareEmail] = useState(initial.shareEmailPostMatch);
  const [sharePhone, setSharePhone] = useState(initial.sharePhonePostMatch);

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
        additionalBlockedCompanies: blocks.map((b) => ({ companyId: b.company!.id, reason: b.reason })),
        fullName: fullName.trim() || undefined,
        shareCompanyPreMatch,
        shareFullNamePostMatch: shareFullName,
        sharePhotoPostMatch: sharePhoto,
        phoneNumber: phoneNumber.trim() || undefined,
        shareEmailPostMatch: shareEmail,
        sharePhonePostMatch: sharePhone,
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
      {/* The former "block entire corporate group" section was removed here
          (backlog item 6) — see the matching comment in PrivacyStepForm.tsx. */}

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">חברות חסומות</h2>
        {currentCompanyName && (
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
        <p className="text-sm text-muted">
          שם מלא ותמונה לעולם לא מוצגים לפני אישור הדדי. במקומם, המערכת מציגה אתכם עם כינוי ואייקון
          אקראיים שנוצרים אוטומטית. אי אפשר לבחור אותם, וזה מכוון: כך הזהות שלכם לא נחשפת בטעות.
          הכינוי משתנה עם כל הצעת התאמה חדשה.
        </p>
        <p className="text-sm text-muted">
          אותו אייקון אנונימי מוצג בכל מצב שבו אין תמונת פרופיל, או שבחרתם שלא לחשוף אותה — גם אחרי
          אישור הדדי. העלאת תמונה אינה חובה בשום שלב, אך היא יכולה לחזק את תחושת האמון והנוחות של הצד
          השני כשמתקבלת הצעת ההתאמה, ולתת להיכרות פתיחה בטוחה יותר.
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
        <h2 className="font-semibold text-ink">מה נחשף לאחר חיבור פעיל</h2>
        <p className="text-sm text-muted">
          לאחר שנוצר חיבור אמיתי (שני הצדדים הביעו עניין הדדי, ולשניכם יש כרטיס גישה פעיל), השם
          המלא, המיקום וקישור ה-LinkedIn נחשפים אוטומטית לצד השני — אין צורך לסמן כל פרט
          בנפרד. כתובת אימייל ומספר טלפון הם היוצאים מהכלל: הם נחשפים רק אם תבחרו לשתף אותם
          במפורש, בכל שלב שתרצו — גם הרבה אחרי יצירת החיבור.
        </p>
        <ProfilePhotoUploadCard
          currentPhotoDataUrl={initial.photoDataUrl}
          avatarFallbackSeed={fullName || "SamePath"}
          onUploaded={() => setSharePhoto(true)}
          onRemoved={() => setSharePhoto(false)}
        />
        {initial.photoDataUrl && <ToggleRow label="להציג את התמונה לאחר אישור הדדי" checked={sharePhoto} onChange={setSharePhoto} />}
        <div className="rounded-xl border border-border bg-paper p-4">
          <label className="block text-sm font-medium text-ink">שם מלא</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="שם מלא"
            className="mt-2 w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
          />
          <p className="mt-2 text-xs text-muted">ייחשף אוטומטית ברגע שייווצר חיבור פעיל.</p>
          <div className="mt-3">
            <ToggleRow label="לחשוף שם פרטי כבר בשלב ההתאמה ההדדית (לפני יצירת החיבור)" checked={shareFullName} onChange={setShareFullName} />
            <p className="mt-1.5 text-xs text-muted">
              סימון זה מקדים רק את החשיפה החלקית: אם תסמנו אותו, השם הפרטי בלבד (המילה הראשונה בשם
              המלא) יוצג כבר ברגע שהצד השני מביע עניין הדדי — עוד לפני שהחיבור נפתח בפועל. השם המלא
              עצמו ייחשף בכל מקרה ברגע שייווצר חיבור פעיל, גם בלי לסמן כאן.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-paper p-4">
          <label className="block text-sm font-medium text-ink">כתובת אימייל</label>
          <p className="mt-1 text-sm text-muted" dir="ltr">
            {initial.email}
          </p>
          <div className="mt-3">
            <ToggleRow label="לחשוף את כתובת האימייל לאחר חיבור פעיל" checked={shareEmail} onChange={setShareEmail} />
            <p className="mt-1.5 text-xs text-muted">
              כברירת מחדל כתובת האימייל אינה נחשפת לעולם, גם לא לאחר חיבור פעיל. אפשר לאפשר זאת בכל
              שלב — גם הרבה אחרי יצירת החיבור.
            </p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">מספר טלפון (אופציונלי)</label>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            dir="ltr"
            className="mt-2 w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
          />
          <p className="mt-1.5 text-xs text-muted">אפשר להשאיר ריק.</p>
          <div className="mt-3">
            <ToggleRow label="לחשוף את מספר הטלפון לאחר חיבור פעיל" checked={sharePhone} onChange={setSharePhone} />
            <p className="mt-1.5 text-xs text-muted">
              כברירת מחדל מספר הטלפון אינו נחשף לעולם, גם לא לאחר חיבור פעיל. אפשר לאפשר זאת בכל
              שלב — גם הרבה אחרי יצירת החיבור.
            </p>
          </div>
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
