import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getUserDetailForAdmin } from "@/modules/admin/users";
import { UserStatusActions } from "@/modules/admin/UserStatusActions";
import { cn } from "@/shared/ui/cn";

export const metadata: Metadata = { title: "פרטי משתמש — SamePath Admin" };

const statusLabels: Record<string, { label: string; className: string }> = {
  PENDING_APPROVAL: { label: "ממתין לאישור", className: "bg-sand text-ink" },
  ACTIVE: { label: "פעיל", className: "bg-mint text-primary-dark" },
  PAUSED: { label: "מושהה", className: "bg-paper text-muted" },
  SUSPENDED: { label: "חסום", className: "bg-danger/10 text-danger-dark" },
};

const genderLabels: Record<string, string> = { MALE: "גבר", FEMALE: "אישה" };

const dateFormat = new Intl.DateTimeFormat("he-IL", { dateStyle: "short" });
const monthFormat = new Intl.DateTimeFormat("he-IL", { month: "2-digit", year: "numeric" });

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default async function AdminUserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const user = await getUserDetailForAdmin(id);
  if (!user) notFound();

  const profile = user.professionalProfile;
  const disclosure = profile?.disclosurePreference;
  const status = statusLabels[user.status] ?? { label: user.status, className: "bg-paper text-muted" };
  const liveUploads = user.resumeUploads.filter((u) => !u.deletedAt && u.status !== "DELETED");
  const deletedUploads = user.resumeUploads.length - liveUploads.length;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-primary hover:text-primary-dark">
        → חזרה לרשימת המשתמשים
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">{disclosure?.fullName || user.email}</h1>
          <p className="mt-1 text-sm text-muted" dir="ltr">
            {user.email}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className={cn("rounded-full px-2.5 py-1", status.className)}>{status.label}</span>
            <span>נרשם/ה {dateFormat.format(user.createdAt)}</span>
            <span>· {user.emailVerifiedAt ? "אימייל אומת" : "אימייל לא אומת"}</span>
            {user.lastLoginAt && <span>· כניסה אחרונה {dateFormat.format(user.lastLoginAt)}</span>}
          </div>
        </div>
        <UserStatusActions userId={user.id} email={user.email} status={user.status} />
      </div>

      <Section title="קורות חיים">
        {liveUploads.length === 0 ? (
          <p className="text-sm text-muted">
            {deletedUploads > 0 ? "הקובץ שהועלה נמחק." : "לא הועלו קורות חיים — הפרופיל מולא ידנית."}
          </p>
        ) : (
          <ul className="space-y-2">
            {liveUploads.map((upload) => (
              <li key={upload.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink">
                  <span dir="ltr">{upload.originalFilename}</span>
                  <span className="ms-2 text-xs text-muted">
                    {formatSize(upload.sizeBytes)} · {dateFormat.format(upload.uploadedAt)}
                  </span>
                </span>
                <span className="flex gap-3">
                  <a
                    href={`/api/admin/resumes/${upload.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:text-primary-dark"
                  >
                    צפייה
                  </a>
                  <a href={`/api/admin/resumes/${upload.id}?download=1`} className="text-muted hover:text-ink">
                    הורדה
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        {profile?.cvVerifiedAt && (
          <p className="mt-3 text-xs text-muted">פרטי הפרופיל אושרו מול הקו״ח ב-{dateFormat.format(profile.cvVerifiedAt)}</p>
        )}
      </Section>

      <Section title="פרטים אישיים">
        <Fields>
          <Field label="שם מלא" value={disclosure?.fullName} />
          <Field
            label="לינקדאין"
            value={
              disclosure?.linkedInUrl ? (
                <a
                  href={disclosure.linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="break-all text-primary hover:text-primary-dark"
                >
                  {disclosure.linkedInUrl}
                </a>
              ) : null
            }
          />
          <Field label="טלפון" value={disclosure?.phoneNumber ? <span dir="ltr">{disclosure.phoneNumber}</span> : null} />
          <Field label="מגדר" value={profile?.gender ? genderLabels[profile.gender] ?? profile.gender : null} />
          <Field label="אזור" value={profile?.region?.labelHe} />
        </Fields>
      </Section>

      {profile ? (
        <>
          <Section title="פרופיל מקצועי">
            <Fields>
              <Field label="סטטוס פרופיל" value={profile.status} />
              <Field label="תחום" value={profile.professionalField?.labelHe} />
              <Field label="תפקיד נוכחי" value={profile.currentRoleTitle} />
              <Field label="חברה נוכחית" value={profile.currentCompany?.canonicalName} />
              <Field label="דרג ותק" value={profile.seniorityBand?.labelHe} />
              <Field
                label="שנות ניסיון"
                value={profile.experienceMonths > 0 ? (profile.experienceMonths / 12).toFixed(1) : null}
              />
              <Field
                label="תפקידי יעד"
                value={profile.targetRoles.map((r) => r.targetRole.labelHe).join(", ") || null}
              />
              <Field label="מיומנויות ותחומים" value={profile.tags.map((t) => t.tag.labelHe).join(", ") || null} />
            </Fields>
            {profile.shortIntro && (
              <p className="mt-4 rounded-xl bg-paper p-3 text-sm text-ink">{profile.shortIntro}</p>
            )}
          </Section>

          <Section title="היסטוריית תעסוקה">
            {profile.employmentPositions.length === 0 ? (
              <p className="text-sm text-muted">אין תפקידים רשומים.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {profile.employmentPositions.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="text-ink">
                      {p.title} · {p.company?.canonicalName ?? p.companyRaw}
                    </span>
                    <span className="text-muted" dir="ltr">
                      {monthFormat.format(p.startDate)} – {p.endDate ? monthFormat.format(p.endDate) : p.isCurrent ? "היום" : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      ) : (
        <Section title="פרופיל מקצועי">
          <p className="text-sm text-muted">המשתמש/ת עוד לא יצר/ה פרופיל.</p>
        </Section>
      )}

      {user.blockedCompanies.length > 0 && (
        <Section title="חברות חסומות">
          <p className="text-sm text-ink">{user.blockedCompanies.map((b) => b.company.canonicalName).join(", ")}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Fields({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value ?? "—"}</dd>
    </div>
  );
}
