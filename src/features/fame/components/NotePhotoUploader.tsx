/**
 * NotePhotoUploader — file input for uploading a note photo to Supabase Storage.
 *
 * Validates the selected file client-side (MIME type and size), uploads it via
 * the `fameApi.uploadNotePhoto` RTK Query mutation, then returns the resulting
 * Storage public URL to the parent form through `onUploadSuccess`.
 *
 * On failure it displays a human-readable error message and does NOT proceed.
 *
 * Requirements: 1.4, 1.5, 3.1, 3.2, 3.3
 */
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUploadNotePhotoMutation } from "@/features/fame/api/fameApi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Accepted MIME types — Requirement 1.5 */
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Accepted MIME types as a comma-separated string for the file input's `accept` attr. */
const ACCEPT_ATTR = ACCEPTED_MIME_TYPES.join(", ");

/** Maximum file size in bytes: 5 MB — Requirement 1.4 */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 5;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NotePhotoUploaderProps {
  /** Called with the Storage public URL when the upload completes successfully. */
  onUploadSuccess: (url: string) => void;
  /** Optional callback fired when validation or upload fails. */
  onUploadError?: (error: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NotePhotoUploader renders a styled file input and handles:
 * - Client-side MIME type and file-size validation
 * - Upload to Supabase Storage via `fameApi.uploadNotePhoto`
 * - Loading / progress feedback during the upload
 * - Error display on validation or upload failure
 * - Preview of the uploaded image on success
 * - Clearing error and preview state when a new file is selected
 */
export function NotePhotoUploader({
  onUploadSuccess,
  onUploadError,
  className,
}: NotePhotoUploaderProps) {
  const [uploadNotePhoto, { isLoading }] = useUploadNotePhotoMutation();

  /** Local preview ObjectURL (revoked on each new selection). */
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Keep a ref to the previous object URL so we can revoke it.
  const prevObjectUrl = React.useRef<string | null>(null);

  // Clean up the ObjectURL when the component unmounts.
  React.useEffect(() => {
    return () => {
      if (prevObjectUrl.current) {
        URL.revokeObjectURL(prevObjectUrl.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    // Revoke previous preview URL to avoid memory leaks.
    if (prevObjectUrl.current) {
      URL.revokeObjectURL(prevObjectUrl.current);
      prevObjectUrl.current = null;
    }

    // Clear previous state whenever a new file is selected.
    setPreviewUrl(null);
    setErrorMessage(null);

    if (!file) return;

    // ---- Client-side validation ----

    // MIME type check — Requirement 1.5
    if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
      const msg = `Unsupported file type "${file.type}". Please choose a JPEG, PNG, WebP, or GIF image.`;
      setErrorMessage(msg);
      onUploadError?.(msg);
      return;
    }

    // File size check — Requirement 1.4
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const msg = `File is too large (${sizeMB} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`;
      setErrorMessage(msg);
      onUploadError?.(msg);
      return;
    }

    // ---- Upload ----
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const msg = "You must be signed in to upload a photo.";
      setErrorMessage(msg);
      onUploadError?.(msg);
      return;
    }

    const result = await uploadNotePhoto({ file, userId: user.id });

    if ("error" in result) {
      const msg =
        typeof result.error === "object" && result.error !== null && "message" in result.error
          ? String((result.error as { message: unknown }).message)
          : "Photo upload failed. Check your connection and try again.";
      setErrorMessage(msg);
      onUploadError?.(msg);
      return;
    }

    // Success — create a local preview and notify the parent.
    const objectUrl = URL.createObjectURL(file);
    prevObjectUrl.current = objectUrl;
    setPreviewUrl(objectUrl);
    onUploadSuccess(result.data);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* File input */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="note-photo-input"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Note photo
          <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
        </label>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => document.getElementById("note-photo-input")?.click()}
            aria-busy={isLoading}
          >
            {isLoading ? "Uploading…" : "Choose photo"}
          </Button>

          <span className="text-xs text-muted-foreground">
            JPEG, PNG, WebP or GIF · max {MAX_FILE_SIZE_MB} MB
          </span>
        </div>

        {/* Hidden native file input */}
        <input
          id="note-photo-input"
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          aria-label="Select note photo"
          disabled={isLoading}
          onChange={handleFileChange}
          // Reset value so re-selecting the same file triggers onChange.
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
        />
      </div>

      {/* Upload progress indicator */}
      {isLoading && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Uploading photo…
        </p>
      )}

      {/* Error message — Requirement 3.3 */}
      {errorMessage && (
        <p
          className="text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {errorMessage}
        </p>
      )}

      {/* Preview — Requirement 3.2 */}
      {previewUrl && !errorMessage && (
        <div className="relative w-24 h-24 rounded-md overflow-hidden border border-border">
          <img
            src={previewUrl}
            alt="Note photo preview"
            className="object-cover w-full h-full"
          />
        </div>
      )}
    </div>
  );
}
