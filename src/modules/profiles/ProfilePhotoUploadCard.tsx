"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProfilePhotoAction, deleteProfilePhotoAction } from "@/modules/profiles/actions";
import { Avatar } from "@/shared/ui/Avatar";

/**
 * Uploading (validation, malware scan, storage write, DB upsert) is one request start to finish —
 * there's no real byte-level progress channel, same situation as ResumeUploadCard. These labels
 * advance on a timer purely to reflect what's actually happening in that request's order, not a
 * fake progress bar.
 */
const UPLOAD_STAGE_LABELS = ["מעלה את התמונה…", "סורק את הקובץ…", "שומר…"];

type Status = { kind: "idle" } | { kind: "success"; message: string } | { kind: "error"; message: string };

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
  const stageTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const previewUrlRef = useRef<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [removing, startRemove] = useTransition();
  const [stage, setStage] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState(false);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  // previewUrl and optimisticallyRemoved are deliberately never reset by watching
  // currentPhotoDataUrl in an effect (that would mean calling setState from inside an effect body
  // purely to sync it with a prop, which React's own guidance and this project's lint rules flag —
  // see https://react.dev/learn/you-might-not-need-an-effect). It isn't needed anyway: once
  // router.refresh() lands, currentPhotoDataUrl already renders identically to the local preview
  // it's superseding (same bytes just uploaded, or null after a removal), and optimisticallyRemoved
  // only ever mattered while currentPhotoDataUrl was still momentarily stale — once it's actually
  // null, `Boolean(currentPhotoDataUrl)` is false either way. Both are cleared explicitly instead,
  // at the point a new selection or removal actually happens (see handleFileSelected/handleRemove),
  // and the object URL is still revoked on unmount below so nothing leaks.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      stageTimeouts.current.forEach(clearTimeout);
    },
    [],
  );

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);
    setOptimisticallyRemoved(false);
    setStatus({ kind: "idle" });
    setStage(0);
    stageTimeouts.current.forEach(clearTimeout);
    stageTimeouts.current = [setTimeout(() => setStage(1), 500), setTimeout(() => setStage(2), 1400)];

    const formData = new FormData();
    formData.set("file", file);

    startUpload(async () => {
      const result = await uploadProfilePhotoAction(formData);
      stageTimeouts.current.forEach(clearTimeout);
      if (inputRef.current) inputRef.current.value = "";
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error ?? "משהו השתבש" });
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        setPreviewUrl(null);
        return;
      }
      setStatus({ kind: "success", message: "התמונה עודכנה בהצלחה" });
      onUploaded?.();
      router.refresh();
    });
  }

  function handleRemove() {
    setStatus({ kind: "idle" });
    startRemove(async () => {
      const result = await deleteProfilePhotoAction();
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error ?? "משהו השתבש" });
        return;
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      setPreviewUrl(null);
      setOptimisticallyRemoved(true);
      setStatus({ kind: "success", message: "התמונה הוסרה" });
      onRemoved?.();
      router.refresh();
    });
  }

  const shownUrl = optimisticallyRemoved ? null : (previewUrl ?? currentPhotoDataUrl);
  const hasPhoto = Boolean(currentPhotoDataUrl) && !optimisticallyRemoved;
  const pending = uploading || removing;

  return (
    <div className="rounded-2xl border border-dashed border-primary/40 bg-mint/40 p-5">
      <h3 className="font-semibold text-ink">תמונת פרופיל</h3>
      <p className="mt-1 text-sm text-muted">
        כך הצד השני ידע את מי הוא עומד לפגוש וירגיש בנוח עוד לפני המפגש הראשון — אך זה לגמרי
        אופציונלי. כל עוד אין תמונה, או שבחרתם לא לחשוף אותה, תוצג במקומה סמלית אנונימית קבועה,
        גם אחרי אישור הדדי. התמונה עצמה, כשיש כזו, לעולם לא מוצגת לפני אישור הדדי.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data/blob URL preview, not an optimizable remote asset
          <img src={shownUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
        ) : (
          <Avatar seed={avatarFallbackSeed} size="lg" />
        )}
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {uploading && <Spinner />}
            {uploading ? UPLOAD_STAGE_LABELS[stage] : hasPhoto ? "החלפת תמונה" : "העלאת תמונה"}
          </button>
          {hasPhoto && !uploading && (
            <button
              type="button"
              disabled={pending}
              onClick={handleRemove}
              className="text-sm text-muted hover:text-danger disabled:opacity-50"
            >
              {removing ? "מסיר…" : "הסרת תמונה"}
            </button>
          )}
          <span className="text-xs text-muted">JPG, PNG או WebP, עד 3MB</span>
        </div>
      </div>
      {status.kind === "error" && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {status.message}
        </p>
      )}
      {status.kind === "success" && (
        <p className="mt-2 text-sm text-happy-dark" role="status">
          {status.message}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}
