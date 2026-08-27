"use client";

import { useEffect, useRef, useState } from "react";
import { createCompanyAction, searchCompaniesAction } from "@/modules/companies/actions";
import { cn } from "@/shared/ui/cn";

export interface CompanySelection {
  id: string;
  canonicalName: string;
}

export function CompanyPicker({
  value,
  onChange,
  placeholder = "שם החברה",
  inputId,
}: {
  value: CompanySelection | null;
  onChange: (value: CompanySelection | null) => void;
  placeholder?: string;
  inputId?: string;
}) {
  const [query, setQuery] = useState(value?.canonicalName ?? "");
  const [results, setResults] = useState<CompanySelection[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resync the visible text when the parent resets `value` (e.g. clearing the
  // form). This is the React-recommended "adjust state during render" pattern
  // for derived state, not an effect, so it can't cause a setState-in-effect
  // cascade.
  const [syncedValueId, setSyncedValueId] = useState(value?.id);
  if (value?.id !== syncedValueId) {
    setSyncedValueId(value?.id);
    setQuery(value?.canonicalName ?? "");
  }

  useEffect(() => {
    if (value && query === value.canonicalName) return;
    const timeout = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      const found = await searchCompaniesAction(query);
      setResults(found);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleCreateNew() {
    setCreating(true);
    try {
      const company = await createCompanyAction(query.trim());
      onChange(company);
      setQuery(company.canonicalName);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-border bg-white px-4 py-3 text-ink placeholder:text-muted focus-visible:border-primary"
      />
      {open && query.trim().length >= 2 && !value && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-white p-1 shadow-md">
          {results.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => {
                onChange(company);
                setQuery(company.canonicalName);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-mint",
              )}
            >
              {company.canonicalName}
            </button>
          ))}
          <button
            type="button"
            disabled={creating}
            onClick={handleCreateNew}
            className="block w-full rounded-lg px-3 py-2 text-right text-sm text-primary hover:bg-mint disabled:opacity-50"
          >
            {creating ? "מוסיף…" : `החברה לא ברשימה — הוספת "${query.trim()}"`}
          </button>
        </div>
      )}
    </div>
  );
}
