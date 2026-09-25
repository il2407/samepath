import Link from "next/link";
import type { Metadata } from "next";
import { countUsersByFilter, listUsersForAdmin, type UserFilter } from "@/modules/admin/users";
import { UserStatusActions } from "@/modules/admin/UserStatusActions";
import { cn } from "@/shared/ui/cn";

export const metadata: Metadata = { title: "משתמשים — SamePath Admin" };

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "PENDING", label: "ממתינים לאישור" },
  { value: "ACTIVE", label: "פעילים" },
  { value: "BLOCKED", label: "חסומים" },
  { value: "ALL", label: "כולם" },
];

const statusLabels: Record<string, { label: string; className: string }> = {
  PENDING_APPROVAL: { label: "ממתין לאישור", className: "bg-sand text-ink" },
  ACTIVE: { label: "פעיל", className: "bg-mint text-primary-dark" },
  PAUSED: { label: "מושהה", className: "bg-paper text-muted" },
  SUSPENDED: { label: "חסום", className: "bg-danger/10 text-danger-dark" },
};

const dateFormat = new Intl.DateTimeFormat("he-IL", { dateStyle: "short" });

function parseFilter(value: unknown): UserFilter {
  return FILTERS.some((f) => f.value === value) ? (value as UserFilter) : "PENDING";
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const params = await searchParams;
  const filter = parseFilter(params.filter);
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const [users, counts] = await Promise.all([listUsersForAdmin(filter, search || undefined), countUsersByFilter()]);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">משתמשים</h1>
      <p className="mt-3 text-sm text-muted">
        חשבון חדש ממתין לאישור לפני שהוא מתחיל לקבל התאמות. חשבון חסום לא יכול להיכנס או להירשם מחדש עם אותה כתובת.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={{ pathname: "/admin/users", query: { filter: f.value, ...(search ? { q: search } : {}) } }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm",
                f.value === filter ? "border-ink bg-ink text-white" : "border-border bg-white text-ink hover:border-primary",
              )}
            >
              {f.label} ({counts[f.value]})
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="filter" value={filter} />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="חיפוש לפי אימייל"
            className="w-56 rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
          />
        </form>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-paper text-right text-xs text-muted">
            <tr>
              <th className="p-3">אימייל</th>
              <th className="p-3">תפקיד נוכחי</th>
              <th className="p-3">נרשם/ה</th>
              <th className="p-3">כניסה אחרונה</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
                  אין משתמשים להצגה
                </td>
              </tr>
            )}
            {users.map((u) => {
              const status = statusLabels[u.status] ?? { label: u.status, className: "bg-paper text-muted" };
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3 text-ink">
                    <Link href={`/admin/users/${u.id}`} dir="ltr" className="font-medium hover:text-primary hover:underline">
                      {u.email}
                    </Link>
                    {!u.emailVerified && <span className="ms-2 text-xs text-muted">(אימייל לא אומת)</span>}
                  </td>
                  <td className="p-3 text-muted">{u.roleTitle ?? (u.profileStatus ? "—" : "טרם השלים/ה פרופיל")}</td>
                  <td className="p-3 text-muted">{dateFormat.format(u.createdAt)}</td>
                  <td className="p-3 text-muted">{u.lastLoginAt ? dateFormat.format(u.lastLoginAt) : "—"}</td>
                  <td className="p-3">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs", status.className)}>{status.label}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/admin/users/${u.id}`} className="text-xs text-primary hover:text-primary-dark">
                        פרטים מלאים
                      </Link>
                      <UserStatusActions userId={u.id} email={u.email} status={u.status} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
