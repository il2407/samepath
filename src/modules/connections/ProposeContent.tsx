"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/Button";
import { changePracticeAction } from "./content-actions";

export type PracticeConnectionOption = {
  id: string;
  name: string;
  revision: number;
};
export function ProposeContent({
  contentKey,
  connections,
  connectionId,
}: {
  contentKey: string;
  connections: PracticeConnectionOption[];
  connectionId?: string;
}) {
  const contextual = connections.find((c) => c.id === connectionId);
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState(
    contextual?.id ?? (connections.length === 1 ? connections[0].id : ""),
  );
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  if (!connections.length)
    return (
      <p className="my-4 text-sm text-muted">
        אפשר לעיין בתוכן כבר עכשיו. אחרי אישור הדדי תוכלו להציע אותו לחיבור.{" "}
        <Link href="/app/matches" className="underline">
          להצעות התאמה
        </Link>
      </p>
    );
  const target = connections.find((c) => c.id === selected);
  function propose() {
    if (!target) return;
    startTransition(async () => {
      try {
        const result = await changePracticeAction({
          connectionId: target.id,
          key: contentKey,
          revision: target.revision,
        });
        if (!result.ok) {
          setError(result.error ?? "השמירה לא הצליחה");
          router.refresh();
          return;
        }
        router.push(`/app/connections/${target.id}#practice`);
      } catch {
        setError("השמירה לא הצליחה. נסו שוב");
      }
    });
  }
  return (
    <div className="my-4 space-y-3 rounded-xl border border-border bg-white p-4">
      {!contextual && !choosing ? (
        <Button onClick={() => setChoosing(true)}>הציעו לחיבור</Button>
      ) : (
        <>
          {contextual ? (
            <p className="text-sm text-muted">
              מציעים ל{contextual.name} · ההצעה מבטאת את ההסכמה שלך.
            </p>
          ) : (
            <label className="block text-sm text-ink">
              עם מי נתרגל?
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-border bg-white p-3"
              >
                <option value="">בחירת חיבור</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button disabled={busy || !target} onClick={propose}>
            {busy ? "שולחים…" : "הציעו תוכן למפגש"}
          </Button>
          {contextual && (
            <Link
              href={`/app/connections/${contextual.id}`}
              className="ms-3 text-sm underline"
            >
              חזרה לחיבור
            </Link>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
