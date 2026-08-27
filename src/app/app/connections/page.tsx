import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { listConnectionsForUser } from "@/modules/connections/service";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "החיבורים שלי — SamePath" };

const statusLabels: Record<string, string> = {
  ACTIVE: "פעיל",
  ENDED: "הסתיים",
  BLOCKED: "נחסם",
  REPORTED: "דווח",
};

export default async function ConnectionsPage() {
  const user = await requireUser();
  if ((await getOnboardingStep(user.id)) !== "done") redirect("/app");

  const connections = await listConnectionsForUser(user.id);

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">החיבורים שלי</h1>
      <p className="mt-2 text-muted">חיבורים שנפתחו לאחר אישור הדדי.</p>

      <div className="mt-8 space-y-3">
        {connections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            עדיין אין חיבורים פעילים. הם יופיעו כאן אחרי התאמה הדדית.
          </div>
        ) : (
          connections.map((c) => (
            <Link
              key={c.id}
              href={`/app/connections/${c.id}`}
              className="flex items-center justify-between rounded-2xl border border-border bg-white p-5 hover:border-primary"
            >
              <span className="font-medium text-ink">{c.otherPartyDisplayName}</span>
              <span className="text-sm text-muted">{statusLabels[c.status] ?? c.status}</span>
            </Link>
          ))
        )}
      </div>
    </Container>
  );
}
