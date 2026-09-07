"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProfilePhotoAction, deleteProfilePhotoAction } from "@/modules/profiles/actions";
import { Avatar } from "@/shared/ui/Avatar";

export function ProfilePhotoUploadCard({
  currentPhotoDataUrl,
  avatarFallbackSeed,
  onUploaded,
  onRemoved,
}: {
  currentPhotoDataUrl: string | null;
  avatarFallbackSeed: string;
  onUploaded?: () => void;
  onRemoved?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return setError("יש לבחור תמונה");
    setError(null);

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadProfilePhotoAction(formData);
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.();
      router.refresh();
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProfilePhotoAction();
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      onRemoved?.();
      router.refresh();
    });
  }

  const shownUrl = previewUrl ?? currentPhotoDataUrl;

  return (
    <div className="rounded-2xl border border-dashed border-primary/40 bg-mint/40 p-5">
      <h3 className="font-semibold text-ink">תמונת פרופיל</h3>
      <p className="mt-1 text-sm text-muted">
        כך הצד השני ידע את מי הוא עומד לפגוש וירגיש בנוח עוד לפני המפגש הראשון.
        <br />
        התמונה לא מוצגת לאף אחד לפני אישור הדדי, ותוצג רק אם תבחרו לחשוף אותה גם אחרי.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data/blob URL preview, not an optimizable remote asset
          <img src={shownUrl} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <Avatar seed={avatarFallbackSeed} size="lg" />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="text-sm"
          />
          <button
            type="button"
            disabled={pending}
            onClick={handleUpload}
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {pending ? "מעלה…" : "העלאת תמונה"}
          </button>
          {currentPhotoDataUrl && (
            <button type="button" disabled={pending} onClick={handleRemove} className="text-sm text-muted hover:text-danger">
              הסרת תמונה
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
