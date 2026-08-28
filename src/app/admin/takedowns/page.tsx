import type { Metadata } from "next";
import { requireModerator } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { TakedownQueue } from "@/modules/admin/TakedownQueue";

export const metadata: Metadata = { title: "בקשות הסרה — SamePath Admin" };

export default async function AdminTakedownsPage() {
  await requireModerator();

  const takedowns = await prisma.takedownRequest.findMany({
    where: { status: { in: ["OPEN", "IN_REVIEW"] } },
    include: { experience: { include: { company: { select: { canonicalName: true } } } }, company: { select: { canonicalName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">בקשות הסרה</h1>
      <p className="mt-1 text-sm text-muted">בקשות הגעה חיצוניות (למשל מנציג חברה) להסרת תוכן מספריית הראיונות.</p>
      <div className="mt-6">
        <TakedownQueue
          rows={takedowns.map((t) => ({
            id: t.id,
            requesterName: t.requesterName,
            requesterEmail: t.requesterEmail,
            reason: t.reason,
            status: t.status,
            createdAt: t.createdAt,
            experienceId: t.experienceId,
            companyName: t.experience?.company.canonicalName ?? t.company?.canonicalName ?? null,
          }))}
        />
      </div>
    </div>
  );
}
