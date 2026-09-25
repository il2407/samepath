import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { listMyContributions } from "@/modules/interviews/contributions";
import { ContributionsList } from "@/modules/interviews/ContributionsList";
import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { FlowNav } from "../FlowNav";

export const metadata: Metadata = { title: "התרומות שלי — SamePath" };

export default async function ContributionsPage() {
  const user = await requireUser();
  const contributions = await listMyContributions(user.id);

  return (
    <Container className="max-w-2xl py-10">
      <FlowNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">התרומות שלי</h1>
        <LinkButton href="/app/contributions/new" className="px-4 py-2 text-sm">
          שיתוף חוויית ראיון
        </LinkButton>
      </div>

      <div className="mt-8">
        <ContributionsList
          contributions={contributions.map((c) => ({
            id: c.id,
            companyName: c.company.canonicalName,
            status: c.status,
            questionCount: c.questions.length,
            createdAt: c.createdAt.toISOString(),
            revisionMessage: c.status === "NEEDS_CHANGES" ? (c.revisionRequests[0]?.message ?? null) : null,
          }))}
        />
      </div>

      <p className="mt-6 text-sm text-muted">
        <Link href="/app/credits" className="text-primary hover:text-primary-dark">
          לצפייה ביתרת הקרדיטים שלי
        </Link>
      </p>
    </Container>
  );
}
