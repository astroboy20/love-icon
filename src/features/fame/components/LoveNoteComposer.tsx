/**
 * LoveNoteComposer — modal form for publishing a LoveNote to the Love of Fame feed.
 *
 * Replaces the old `src/components/LoveNoteComposer.tsx` that used the
 * `useLove()` context store. This version uses RTK Query mutations from
 * `fameApi` for both photo upload and note publishing.
 *
 * Photo upload flow (Requirements 3.1–3.5):
 *   1. If a photo is selected, call `uploadNotePhoto` first.
 *   2. On upload success, store the returned public Storage URL.
 *   3. On upload failure, display an error and do NOT proceed with publishing.
 *   4. If no photo selected, proceed with `image_url: null`.
 *
 * RTK Query loading/error states are used for all UI feedback (Req 18.2).
 * The component reads current user identity from the Redux `authSlice`
 * (Req 22.7, 22.11).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 18.2, 22.7, 22.11
 */
import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Modal } from "@/components/Modal";
import { usePublishNoteMutation, useUploadNotePhotoMutation } from "@/features/fame/api/fameApi";
import { useAppSelector } from "@/app/store";
import { selectCurrentUser } from "@/features/auth/slices/authSlice";
import { NOTE_CATEGORIES, type LoveType, type NoteCategory } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LoveNoteComposerProps {
  open: boolean;
  loveType: LoveType;
  onClose: () => void;
  presetCoinId?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LoveNoteComposer renders a modal that lets authenticated users compose and
 * publish a LoveNote. It orchestrates photo upload (if selected) before
 * publishing, and shows loading/error feedback throughout.
 */
export function LoveNoteComposer({
  open,
  loveType,
  onClose,
  presetCoinId,
}: LoveNoteComposerProps) {
  const navigate = useNavigate();
  const currentUser = useAppSelector(selectCurrentUser);

  // ---- RTK Query mutations ----
  const [publishNote, { isLoading: isPublishing }] = usePublishNoteMutation();
  const [uploadNotePhoto, { isLoading: isUploading }] = useUploadNotePhotoMutation();

  // ---- Local form state ----
  const [content, setContent] = React.useState("");
  const [category, setCategory] = React.useState<NoteCategory>("Kindness");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [coinId, setCoinId] = React.useState<string>(presetCoinId ?? "");
  const [published, setPublished] = React.useState(false);

  // Keep a ref to the object URL so we can revoke it on cleanup.
  const prevObjectUrl = React.useRef<string | null>(null);

  // Clean up the preview ObjectURL on unmount.
  React.useEffect(() => {
    return () => {
      if (prevObjectUrl.current) {
        URL.revokeObjectURL(prevObjectUrl.current);
      }
    };
  }, []);

  // Sync coinId if presetCoinId changes.
  React.useEffect(() => {
    setCoinId(presetCoinId ?? "");
  }, [presetCoinId]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isBusy = isUploading || isPublishing;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const close = () => {
    setContent("");
    setCategory("Kindness");
    setPhotoFile(null);
    setPhotoPreview(null);
    setCoinId(presetCoinId ?? "");
    setPublished(false);

    if (prevObjectUrl.current) {
      URL.revokeObjectURL(prevObjectUrl.current);
      prevObjectUrl.current = null;
    }

    onClose();
  };

  /** Handle file selection — validate MIME type and create a local preview. */
  const handlePhotoSelect = (file?: File) => {
    // Revoke previous preview URL to avoid memory leaks.
    if (prevObjectUrl.current) {
      URL.revokeObjectURL(prevObjectUrl.current);
      prevObjectUrl.current = null;
    }

    setPhotoFile(null);
    setPhotoPreview(null);

    if (!file) return;

    const accepted = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!accepted.includes(file.type)) {
      toast.error(`Unsupported file type "${file.type}". Please choose a JPEG, PNG, WebP, or GIF image.`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    prevObjectUrl.current = objectUrl;
    setPhotoFile(file);
    setPhotoPreview(objectUrl);
  };

  /**
   * Submit handler — uploads photo (if present) then publishes the note.
   * Requirements 3.1–3.5: photo upload must succeed before publishing.
   * Requirement 3.3: on upload failure, show error and do NOT publish.
   * Requirement 3.4: no photo → imageUrl is null.
   */
  const handleSubmit = async () => {
    if (!content.trim() || !currentUser) return;

    let imageUrl: string | null = null;

    if (photoFile) {
      const uploadResult = await uploadNotePhoto({ file: photoFile, userId: currentUser.id });

      if ("error" in uploadResult) {
        const err = uploadResult.error;
        toast.error(
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Photo upload failed. Check your connection and try again.",
        );
        return;
      }

      imageUrl = uploadResult.data;
    }

    const publishResult = await publishNote({
      content: content.trim(),
      loveType,
      category,
      imageUrl,
      loveCoinId: coinId || null,
      authorName: currentUser.displayName,
    });

    if ("error" in publishResult) {
      const err = publishResult.error;
      toast.error(
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to publish your LoveNote. Please try again.",
      );
      return;
    }

    setPublished(true);
  };

  // ---------------------------------------------------------------------------
  // Render: sign-in prompt for unauthenticated users
  // ---------------------------------------------------------------------------

  if (open && !currentUser) {
    return (
      <Modal open={open} onClose={close} labelledBy="signin-note-title">
        <div className="py-4 text-center">
          <h2 id="signin-note-title" className="font-display text-3xl text-primary">
            Sign in to share your moment.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            Your LoveNotes are saved to your account, so they stay with you everywhere.
          </p>
          <button
            className="btn-base btn-primary mt-7"
            onClick={() => {
              close();
              navigate({ to: "/auth" });
            }}
          >
            Sign in or create an account
          </button>
        </div>
      </Modal>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: success screen
  // ---------------------------------------------------------------------------

  if (published) {
    return (
      <Modal open={open} onClose={close} labelledBy="published-title">
        <div className="py-4 text-center">
          <div className="font-display text-5xl">💌</div>
          <h2 id="published-title" className="font-display mt-4 text-3xl text-primary">
            Your LoveNote is now part of the Love of Fame.
          </h2>
          <div className="mt-8 rounded-2xl bg-secondary/70 p-6">
            <p className="font-display text-2xl text-primary">Want to keep this moment forever?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn this LoveNote into a LoveCoin.
            </p>
            <button
              className="btn-base btn-primary mt-5"
              onClick={() => {
                close();
                navigate({ to: "/explore" });
              }}
            >
              Create LoveCoin
            </button>
          </div>
          <button className="btn-base btn-ghosted mt-4" onClick={close}>
            Back to the timeline
          </button>
        </div>
      </Modal>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: composer form
  // ---------------------------------------------------------------------------

  return (
    <Modal open={open} onClose={close} labelledBy="composer-title">
      <p className="text-[0.7rem] tracking-[0.3em] text-muted-foreground uppercase">
        {loveType === "gave" ? "❤️ I gave love" : "💕 I received love"}
      </p>
      <h2 id="composer-title" className="font-display mt-2 text-4xl text-primary">
        Tell us about the moment.
      </h2>

      {/* Content textarea */}
      <textarea
        rows={5}
        className="field mt-6 resize-none text-base"
        placeholder="Tell us about the moment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isBusy}
      />

      {/* Category selector */}
      <div className="mt-5">
        <span className="mb-2 block text-sm font-semibold">Category</span>
        <div className="flex flex-wrap gap-2">
          {NOTE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={isBusy}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${
                category === c
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Photo picker */}
      <label
        className={`mt-5 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors ${
          isBusy ? "cursor-not-allowed opacity-50" : "hover:border-primary/40 hover:text-primary"
        }`}
      >
        {isUploading
          ? "Uploading photo…"
          : photoFile
            ? "Photo added — tap to change"
            : "Add a photo (optional)"}
        <input
          type="file"
          accept="image/jpeg, image/png, image/webp, image/gif"
          className="hidden"
          disabled={isBusy}
          onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
          // Reset so re-selecting the same file triggers onChange.
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
        />
      </label>

      {/* Photo preview */}
      {photoPreview && (
        <div className="mt-3 relative w-20 h-20 rounded-md overflow-hidden border border-border">
          <img src={photoPreview} alt="Selected photo preview" className="object-cover w-full h-full" />
        </div>
      )}

      {/* Optional coin link — shown when a presetCoinId was passed */}
      {presetCoinId && (
        <p className="mt-3 text-xs text-muted-foreground">
          This LoveNote will be linked to LoveCoin #{presetCoinId}.
        </p>
      )}

      {/* Submit button */}
      <button
        type="button"
        disabled={!content.trim() || isBusy}
        onClick={handleSubmit}
        aria-busy={isBusy}
        className="btn-base btn-primary mt-7 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading
          ? "Uploading photo…"
          : isPublishing
            ? "Publishing…"
            : "Share LoveNote"}
      </button>
    </Modal>
  );
}
