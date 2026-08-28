import type { Metadata } from "next";
import { getModerationQueue } from "@/modules/moderation/interviews";
import { ModerationQueueCard } from "@/modules/admin/ModerationQueueCard";

export const metadata: Metadata = { title: "מודרציית תרומות — SamePath Admin" };

export default async function AdminContributionsPage() {
  const queue = await getModerationQueue();

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">מודרציית תרומות</h1>
      <p className="mt-2 text-sm text-muted">
        {queue.length} תרומות ממתינות לבדיקה. אישור מעניק קרדיטים באופן חד-פעמי (idempotent) ומתזמן
        פרסום אנונימי לאחר עיכוב.
      </p>

      <div className="mt-6 space-y-4">
        {queue.length === 0 ? (
          <p className="text-sm text-muted">אין כרגע תרומות בהמתנה.</p>
        ) : (
          queue.map((item) => <ModerationQueueCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
