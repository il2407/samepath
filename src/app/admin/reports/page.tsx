import type { Metadata } from "next";
import { requireModerator } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { ReportsQueue } from "@/modules/admin/ReportsQueue";

export const metadata: Metadata = { title: "דיווחים — SamePath Admin" };

export default async function AdminReportsPage() {
  await requireModerator();

  const [userReports, contentReports] = await Promise.all([
    prisma.report.findMany({
      where: { status: { in: ["OPEN", "REVIEWING"] } },
      include: { reporter: { select: { email: true } }, reportedUser: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.contentReport.findMany({
      where: { status: "OPEN" },
      include: { experience: { include: { company: { select: { canonicalName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">דיווחים</h1>
      <div className="mt-6">
        <ReportsQueue
          userReports={userReports}
          contentReports={contentReports.map((r) => ({
            id: r.id,
            reason: r.reason,
            description: r.description,
            createdAt: r.createdAt,
            experienceId: r.experienceId,
            experience: { company: { canonicalName: r.experience.company.canonicalName } },
          }))}
        />
      </div>
    </div>
  );
}
