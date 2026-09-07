import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getGroupDetail } from "@/modules/groups/service";
import { GroupDetailPanel } from "@/modules/groups/GroupDetailPanel";
import { connectionModeLabels } from "@/modules/profiles/labels";
import { Container } from "@/shared/ui/Container";

export default async function GroupDetailPage({ params }: PageProps<"/app/groups/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const group = await getGroupDetail(user.id, id);
  if (!group) notFound();

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">{group.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {[group.professionalField, group.targetRole, group.seniorityRange].filter(Boolean).join(" · ")}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-white p-6 text-sm">
        <Field label="שפה" value={group.language} />
        <Field label="אזור זמן" value={group.timezone} />
        <Field label="אופן מפגש" value={connectionModeLabels[group.mode]} />
        <Field label="לוח זמנים" value={group.schedule} />
        <Field label="נושא" value={group.theme} />
        <Field label="אורך סדרת מפגשים" value={group.seriesLength ? `${group.seriesLength} מפגשים` : null} />
        <Field label="חברים" value={`${group.memberCount}/${group.capacityMax}`} />
      </dl>

      {group.guide && (
        <div className="mt-4 rounded-2xl border border-border bg-mint p-6">
          <span className="rounded-full bg-lime/60 px-3 py-1 text-xs font-semibold text-primary-dark">
            מערך מפגש מוצע
          </span>
          <p className="mt-2 font-semibold text-ink">{group.guide.title}</p>
          <p className="mt-1 text-sm text-ink/80">{group.guide.purpose}</p>
        </div>
      )}

      <GroupDetailPanel group={group} />
    </Container>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
