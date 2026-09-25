import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { listConnectionsForUser } from "@/modules/connections/service";
import { practiceStatus } from "@/modules/connections/content";
import { Avatar } from "@/shared/ui/Avatar";
import { Container } from "@/shared/ui/Container";
import { FlowNav } from "../FlowNav";
import { RememberListPosition } from "../RememberListPosition";

export const metadata: Metadata = { title: "החיבורים שלי — SamePath" };
const statusLabels: Record<string, string> = { ENDED: "החיבור הסתיים", BLOCKED: "החיבור נחסם", REPORTED: "החיבור דווח" };

export default async function ConnectionsPage() {
  const user = await requireUser();
  if ((await getOnboardingStep(user.id)) !== "done") redirect("/app");
  const connections = await listConnectionsForUser(user.id);
  return <Container className="max-w-2xl py-10">
    <RememberListPosition storageKey={`connections:${user.id}`} />
    <FlowNav prev={{ href: "/app/matches", label: "הצעות התאמה" }} next={{ href: "/app/guides", label: "תוכן לתרגול" }} />
    <h1 className="text-2xl font-bold text-ink">החיבורים שלי</h1>
    <p className="mt-2 text-muted">אישרתם הדדית. עכשיו אפשר להכיר בשיחה קצרה ולבחור מה לתרגל יחד.</p>
    <div className="mt-8 space-y-3">
      {!connections.length ? <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-muted">החיבורים יופיעו כאן אחרי ששני הצדדים יאשרו את ההתאמה.</p>
        <Link href="/app/matches" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm text-white">לבחינת הצעות התאמה</Link>
      </div> : connections.map(c => {
        const state = practiceStatus(c.practice, user.id);
        return <article key={c.id} className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-4">
            {c.otherPartyPhotoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- privacy-checked storage data URL
              <img src={c.otherPartyPhotoDataUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
            ) : <Avatar seed={c.otherPartyDisplayName} />}
            <div className="min-w-0"><h2 className="font-semibold text-ink">{c.otherPartyFullName ?? c.otherPartyDisplayName}</h2>
              <p className="mt-1 text-sm text-muted">{[c.otherPartyRole, c.otherPartyCompany].filter(Boolean).join(" · ") || "פרטים מקצועיים טרם נוספו"}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${c.status === "ACTIVE" ? "bg-mint text-primary-dark" : "bg-warm-surface text-muted"}`}>{c.status === "ACTIVE" ? state.label : statusLabels[c.status]}</span>
            <Link href={`/app/connections/${c.id}${c.practice?.pending || c.practice?.agreed ? "#practice" : "#conversation"}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-dark" aria-label={`${c.status === "ACTIVE" ? state.action : "לפרטי החיבור"} עם ${c.otherPartyFullName ?? c.otherPartyDisplayName}`}>{c.status === "ACTIVE" ? state.action : "לפרטי החיבור"} ←</Link>
          </div>
        </article>;
      })}
    </div>
  </Container>;
}
