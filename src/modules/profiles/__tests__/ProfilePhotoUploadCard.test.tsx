// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { ProfilePhotoUploadCard } from "@/modules/profiles/ProfilePhotoUploadCard";

// vi.mock factories can't reference plain module-scope variables declared below them (they're
// hoisted above all imports, before those variables are initialized) — vi.hoisted is the
// documented escape hatch: its callback runs at the same hoisted position as vi.mock itself.
const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  uploadProfilePhotoAction: vi.fn(),
  deleteProfilePhotoAction: vi.fn(),
}));
const { refresh, uploadProfilePhotoAction, deleteProfilePhotoAction } = mocks;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/modules/profiles/actions", () => ({
  uploadProfilePhotoAction: mocks.uploadProfilePhotoAction,
  deleteProfilePhotoAction: mocks.deleteProfilePhotoAction,
}));

const EXISTING_PHOTO = "data:image/jpeg;base64,AAAA";

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  refresh.mockClear();
  uploadProfilePhotoAction.mockReset();
  deleteProfilePhotoAction.mockReset();
  // jsdom doesn't implement the object-URL APIs at all — stub them directly on the global URL
  // constructor so the component's preview logic (URL.createObjectURL / revokeObjectURL) has
  // something to call.
  URL.createObjectURL = vi.fn(() => "blob:mock-preview-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("ProfilePhotoUploadCard", () => {
  it("renders the anonymous avatar fallback (no <img>) when there is no current photo", () => {
    const { container } = render(<ProfilePhotoUploadCard currentPhotoDataUrl={null} avatarFallbackSeed="seed-1" />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
    // Avatar renders an inline DiceBear SVG.
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the existing photo as an <img> when currentPhotoDataUrl is provided", () => {
    const { container } = render(<ProfilePhotoUploadCard currentPhotoDataUrl={EXISTING_PHOTO} avatarFallbackSeed="seed-1" />);
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", EXISTING_PHOTO);
  });

  it("shows 'upload' wording with no existing photo and 'replace' wording when one exists", () => {
    const { rerender } = render(<ProfilePhotoUploadCard currentPhotoDataUrl={null} avatarFallbackSeed="seed-1" />);
    expect(screen.getByRole("button", { name: "העלאת תמונה" })).toBeInTheDocument();

    rerender(<ProfilePhotoUploadCard currentPhotoDataUrl={EXISTING_PHOTO} avatarFallbackSeed="seed-1" />);
    expect(screen.getByRole("button", { name: "החלפת תמונה" })).toBeInTheDocument();
  });

  it("uses a real <button> as the trigger (keyboard-activatable, focusable) that opens the OS file picker via the hidden input", () => {
    render(<ProfilePhotoUploadCard currentPhotoDataUrl={null} avatarFallbackSeed="seed-1" />);
    const button = screen.getByRole("button", { name: "העלאת תמונה" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).not.toBeDisabled();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("hidden");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");

    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(button);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("starts the upload immediately on file selection, with no separate upload-button click", async () => {
    uploadProfilePhotoAction.mockResolvedValue({ ok: true });
    render(<ProfilePhotoUploadCard currentPhotoDataUrl={null} avatarFallbackSeed="seed-1" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" });
    selectFile(input, file);

    await waitFor(() => expect(uploadProfilePhotoAction).toHaveBeenCalledTimes(1));
    const submittedFormData = uploadProfilePhotoAction.mock.calls[0][0] as FormData;
    expect(submittedFormData.get("file")).toBe(file);
  });

  it("shows a preview of the selected file immediately (before the upload resolves)", async () => {
    let resolveUpload!: (value: { ok: true }) => void;
    uploadProfilePhotoAction.mockReturnValue(new Promise((resolve) => (resolveUpload = resolve)));
    const { container } = render(<ProfilePhotoUploadCard currentPhotoDataUrl={null} avatarFallbackSeed="seed-1" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input, new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }));

    await waitFor(() => {
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src", "blob:mock-preview-url");
    });

    resolveUpload({ ok: true });
  });

  it("shows a distinct, visible error state when the upload action fails", async () => {
    uploadProfilePhotoAction.mockResolvedValue({ ok: false, error: "הקובץ גדול מדי" });
    render(<ProfilePhotoUploadCard currentPhotoDataUrl={null} avatarFallbackSeed="seed-1" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input, new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("הקובץ גדול מדי");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a distinct success state and refreshes after a successful upload", async () => {
    const onUploaded = vi.fn();
    uploadProfilePhotoAction.mockResolvedValue({ ok: true });
    render(<ProfilePhotoUploadCard currentPhotoDataUrl={null} avatarFallbackSeed="seed-1" onUploaded={onUploaded} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input, new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("התמונה עודכנה בהצלחה");
    expect(onUploaded).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("removes the photo, shows a success state, and calls onRemoved when deletion succeeds", async () => {
    const onRemoved = vi.fn();
    deleteProfilePhotoAction.mockResolvedValue({ ok: true });
    render(<ProfilePhotoUploadCard currentPhotoDataUrl={EXISTING_PHOTO} avatarFallbackSeed="seed-1" onRemoved={onRemoved} />);

    fireEvent.click(screen.getByRole("button", { name: "הסרת תמונה" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("התמונה הוסרה");
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows an error state when removal fails, without calling onRemoved", async () => {
    const onRemoved = vi.fn();
    deleteProfilePhotoAction.mockResolvedValue({ ok: false, error: "משהו השתבש" });
    render(<ProfilePhotoUploadCard currentPhotoDataUrl={EXISTING_PHOTO} avatarFallbackSeed="seed-1" onRemoved={onRemoved} />);

    fireEvent.click(screen.getByRole("button", { name: "הסרת תמונה" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("משהו השתבש");
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("does not render a remove button when there is no existing photo", () => {
    render(<ProfilePhotoUploadCard currentPhotoDataUrl={null} avatarFallbackSeed="seed-1" />);
    expect(screen.queryByRole("button", { name: "הסרת תמונה" })).not.toBeInTheDocument();
  });

  it("revokes the object URL for a selected-file preview on unmount, to avoid a memory leak", async () => {
    uploadProfilePhotoAction.mockReturnValue(new Promise(() => {})); // never resolves
    const { unmount } = render(<ProfilePhotoUploadCard currentPhotoDataUrl={null} avatarFallbackSeed="seed-1" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input, new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-preview-url");
  });
});
