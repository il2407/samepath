"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProductConfigAction, updateProductConfigAction, grantReplacementPassAction } from "@/modules/admin/product-actions";

export interface ProductRow {
  id: string;
  key: string;
  name: string;
  priceCents: number;
  currency: string;
  accessDurationDays: number;
  isActive: boolean;
}

function ProductRowCard({ product }: { product: ProductRow }) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [priceCents, setPriceCents] = useState(product.priceCents);
  const [accessDurationDays, setAccessDurationDays] = useState(product.accessDurationDays);
  const [isActive, setIsActive] = useState(product.isActive);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateProductConfigAction({ id: product.id, name, priceCents, accessDurationDays, isActive });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      setNotice("נשמר");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <p className="font-mono text-xs text-muted">{product.key}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-border px-2 py-1.5 text-sm" />
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={priceCents}
            onChange={(e) => setPriceCents(Number(e.target.value))}
            className="w-28 rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-muted">אגורות ({product.currency})</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={accessDurationDays}
            onChange={(e) => setAccessDurationDays(Number(e.target.value))}
            className="w-20 rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-muted">ימי גישה</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          פעיל למכירה
        </label>
      </div>
      {notice && <p className="mt-2 text-sm text-primary-dark">{notice}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="mt-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {pending ? "שומר…" : "שמירה"}
      </button>
    </div>
  );
}

function CreateProductForm() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [priceCents, setPriceCents] = useState(14900);
  const [accessDurationDays, setAccessDurationDays] = useState(45);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!key.trim() || !name.trim()) return setError("נדרשים מפתח ושם");
    startTransition(async () => {
      const result = await createProductConfigAction({ key: key.trim(), name: name.trim(), priceCents, accessDurationDays, isActive: true });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      setKey("");
      setName("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-paper p-5">
      <h3 className="text-sm font-semibold text-ink">הוספת מסלול גישה חדש</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="מפתח (למשל extended-pass)" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם לתצוגה" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
        <input type="number" value={priceCents} onChange={(e) => setPriceCents(Number(e.target.value))} placeholder="מחיר באגורות" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
        <input type="number" value={accessDurationDays} onChange={(e) => setAccessDurationDays(Number(e.target.value))} placeholder="ימי גישה" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="button" disabled={pending} onClick={submit} className="mt-2 rounded-full border border-primary px-4 py-1.5 text-sm text-primary-dark hover:bg-mint disabled:opacity-50">
        יצירה
      </button>
    </div>
  );
}

function GrantReplacementForm() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [reason, setReason] = useState("");
  const [extraDays, setExtraDays] = useState(7);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function submit() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await grantReplacementPassAction({ userEmail: userEmail.trim(), reason: reason.trim(), extraDays });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      setNotice("הוענקה גישה חלופית");
      setUserEmail("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <h3 className="text-sm font-semibold text-ink">הענקת גישה חלופית (תמיכה)</h3>
      <p className="mt-1 text-xs text-muted">לשימוש בתקלות תשלום או מקרי שירות לקוחות חריגים.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="אימייל משתמש" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סיבה" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
        <input type="number" value={extraDays} onChange={(e) => setExtraDays(Number(e.target.value))} placeholder="ימים" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
      </div>
      {notice && <p className="mt-2 text-sm text-primary-dark">{notice}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="button" disabled={pending} onClick={submit} className="mt-2 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
        הענקה
      </button>
    </div>
  );
}

export function ProductConfigPanel({ products }: { products: ProductRow[] }) {
  return (
    <div className="space-y-4">
      {products.map((p) => (
        <ProductRowCard key={p.id} product={p} />
      ))}
      <CreateProductForm />
      <GrantReplacementForm />
    </div>
  );
}
