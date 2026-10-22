/**
 * NotePhotoUploader — file input for uploading a note photo to Supabase Storage.
 *
 * Validates the selected file client-side (MIME type and size), uploads it via
 * the `fameApi.uploadNotePhoto` RTK Query mutation, then returns the resulting
 * Storage public URL to the parent form through `onUploadSuccess`.
 *
 * Requirements: 1.4, 1.5, 3.1, 3.2, 3.3
 */
import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUploadNotePhotoMutation } from "@/features/fame/api/fameApi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const ACCEPT_ATTR = ACCEPTED_MIME_TYPES.join(", ");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 5;

export interface NotePhotoUploaderProps {
  onUploadSuccess: (url: string) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

export function NotePhotoUploader({ onUploadSuccess, onUploadError, className }: NotePhotoUploaderProps) {
  const [uploadNotePhoto, { isLoading }] = useUploadNotePhotoMutation();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const prevObjectUrl = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (prevObjectUrl.current) URL.revokeObjectURL(prevObjectUrl.current);
    };
  }, []);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (prevObjectUrl.current) {
      URL.revokeObjectURL(prevObjectUrl.current);
      prevObjectUrl.current = null;
    }
    setPreviewUrl(null);

    if (!file) return;

    // MIME type check — Requirement 1.5
    if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
      const msg = `Unsupported file type "${file.type}". Please choose a JPEG, PNG, WebP, or GIF image.`;
      toast.error(msg);
      onUploadError?.(msg);
      return;
    }

    // File size check — Requirement 1.4
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const msg = `File is too large (${sizeMB} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`;
      toast.error(msg);
      onUploadError?.(msg);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const msg = "You must be signed in to upload a photo.";
      toast.error(msg);
      onUploadError?.(msg);
      return;
    }

    const result = await uploadNotePhoto({ file, userId: user.id });

    if ("error" in result) {
      const msg =
        typeof result.error === "object" && result.error !== null && "message" in result.error
          ? String((result.error as { message: unknown }).message)
          : "Photo upload failed. Check your connection and try again.";
      toast.error(msg);
      onUploadError?.(msg);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    prevObjectUrl.current = objectUrl;
    setPreviewUrl(objectUrl);
    onUploadSuccess(result.data);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
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

        <input
          id="note-photo-input"
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          aria-label="Select note photo"
          disabled={isLoading}
          onChange={handleFileChange}
          onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Uploading photo…
        </p>
      )}

      {/* Preview — Requirement 3.2 */}
      {previewUrl && (
        <div className="relative w-24 h-24 rounded-md overflow-hidden border border-border">
          <img src={previewUrl} alt="Note photo preview" className="object-cover w-full h-full" />
        </div>
      )}
    </div>
  );
}
