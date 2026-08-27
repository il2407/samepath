import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/session";
import { ContributionForm } from "@/modules/interviews/ContributionForm";
import { listSeniorityBands, listRegions, listTargetRoles, listTags } from "@/modules/reference-data/service";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "שיתוף חוויית ראיון — SamePath" };

export default async function NewContributionPage() {
  await requireUser();
  const [targetRoles, seniorityBands, regions, topics] = await Promise.all([
    listTargetRoles(),
    listSeniorityBands(),
    listRegions(),
    listTags("TOPIC"),
  ]);

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">שיתוף חוויית ראיון</h1>
      <p className="mt-2 text-muted">
        התרומה נבדקת על ידי צוות מודרציה ומתפרסמת באופן אנונימי לאחר תקופת המתנה. שם מלא ופרטים מזהים
        אינם מפורסמים לעולם.
      </p>

      <div className="mt-8">
        <ContributionForm
          targetRoles={targetRoles.map((r) => ({ id: r.id, labelHe: r.labelHe }))}
          seniorityBands={seniorityBands.map((b) => ({ id: b.id, labelHe: b.labelHe }))}
          regions={regions.map((r) => ({ id: r.id, labelHe: r.labelHe }))}
          topics={topics.map((t) => ({ id: t.id, labelHe: t.labelHe }))}
        />
      </div>
    </Container>
  );
}
