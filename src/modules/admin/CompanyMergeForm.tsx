"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CompanyPicker, type CompanySelection } from "@/modules/companies/CompanyPicker";
import { Button } from "@/shared/ui/Button";
import { mergeCompaniesAction } from "@/modules/admin/company-actions";

export function CompanyMergeForm() {
  const router = useRouter();
  const [source, setSource] = useState<CompanySelection | null>(null);
  const [target, setTarget] = useState<CompanySelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleMerge() {
    setError(null);
    setNotice(null);
    if (!source || !target) return setError("יש לבחור חברת מקור וחברת יעד");

    startTransition(async () => {
      const result = await mergeCompaniesAction({ sourceId: source.id, targetId: target.id });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setNotice(`${source.canonicalName} מוזגה לתוך ${target.canonicalName}`);
      setSource(null);
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <h2 className="font-semibold text-ink">מיזוג חברות</h2>
      <p className="mt-1 text-sm text-muted">
        חברת המקור תסומן כמוזגה, שם המקור יהפוך לכינוי של חברת היעד, וכל ההפניות (היסטוריית תעסוקה,
        חסימות, תרומות ראיונות) יעברו אליה.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-muted">חברת מקור (תוסר)</p>
          <CompanyPicker value={source} onChange={setSource} placeholder="חיפוש חברת מקור" />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted">חברת יעד (תישאר)</p>
          <CompanyPicker value={target} onChange={setTarget} placeholder="חיפוש חברת יעד" />
        </div>
      </div>
      {notice && <p className="mt-3 text-sm text-primary-dark">{notice}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <Button onClick={handleMerge} disabled={pending} className="mt-4 px-4 py-2 text-sm">
        {pending ? "ממזג…" : "מיזוג"}
      </Button>
    </div>
  );
}
