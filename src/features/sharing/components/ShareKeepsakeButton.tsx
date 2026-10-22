/**
 * ShareKeepsakeButton — share or copy a link to a LoveCoin keepsake.
 *
 * Uses `sharingApi.createShareLink` to generate the shareable URL and
 * `sharingApi.getShareableCoin` to include the coin's creator name and
 * recipient name in the Web Share API payload (title/text).
 *
 * Share strategy:
 *   1. If `navigator.share` is available (mobile, some desktop), invoke
 *      the native Web Share sheet. Falls back to copy-to-clipboard on
 *      any share error (e.g. user cancels, permission denied).
 *   2. Otherwise, copy the URL to the clipboard and surface a short
 *      "Copied!" confirmation via accessible live-region text.
 *
 * States handled:
 *   - Loading (generating link / fetching coin data)
 *   - Success: shared via Web Share API
 *   - Success: link copied to clipboard
 *   - Error: clipboard write failed (displays inline error)
 *   - Disabled: when coinNumber is not yet available
 *
 * Requirements: 22.4
 */
import * as React from "react";
import { Share2, Link, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useGetShareableCoinQuery,
  useCreateShareLinkMutation,
} from "@/features/sharing/api/sharingApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShareKeepsakeButtonProps {
  /** The coin number whose keepsake link should be shared. */
  coinNumber: number;
  /** Optional extra class names forwarded to the button element. */
  className?: string;
  /** Button visual variant — matches shadcn/ui Button variants. */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Button size variant — matches shadcn/ui Button sizes. */
  size?: "default" | "sm" | "lg" | "icon";
  /** Label override. Defaults to "Share" (or hidden in icon-only mode). */
  label?: string;
  /** Render only the icon (no visible label text). Accessible name is still provided. */
  iconOnly?: boolean;
}

// How long the "Copied!" / "Shared!" feedback text lingers (ms).
const FEEDBACK_DURATION_MS = 2500;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ShareKeepsakeButton generates a stable shareable URL for a LoveCoin and
 * invokes the Web Share API (with copy-link fallback) when clicked.
 */
export function ShareKeepsakeButton({
  coinNumber,
  className,
  variant = "outline",
  size = "sm",
  label = "Share",
  iconOnly = false,
}: ShareKeepsakeButtonProps) {
  // ── Server state ──────────────────────────────────────────────────────────
  // Fetch coin meta so the Web Share payload includes a human-readable title.
  // `skip` is not needed here — the query runs lazily; coin data is optional.
  const { data: coin } = useGetShareableCoinQuery(coinNumber);
  const [createShareLink, { isLoading: isCreatingLink }] = useCreateShareLinkMutation();

  // ── Local UI state ────────────────────────────────────────────────────────
  type FeedbackKind = "shared" | "copied" | "error" | null;
  const [feedback, setFeedback] = React.useState<FeedbackKind>(null);
  const feedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending feedback timer on unmount.
  React.useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Show transient feedback text, then reset after FEEDBACK_DURATION_MS. */
  const showFeedback = (kind: FeedbackKind) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback(kind);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);
  };

  /** Build the Web Share API payload from the coin data and URL. */
  const buildShareData = (url: string): ShareData => {
    const recipientName = coin?.recipient_name ?? "";
    const creatorName = coin?.creator_name ?? "";

    const title = recipientName
      ? `A LoveCoin for ${recipientName}`
      : "A LoveCoin keepsake";

    const text = creatorName
      ? `${creatorName} created a LoveCoin keepsake. View it here:`
      : "Someone created a LoveCoin keepsake. View it here:";

    return { title, text, url };
  };

  /** Write the URL to the clipboard, surfacing feedback on success/failure. */
  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showFeedback("copied");
    } catch {
      toast.error("Could not copy link. Please copy it manually.");
      showFeedback("error");
    }
  };

  // ── Click handler ─────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (isCreatingLink || feedback === "shared" || feedback === "copied") return;

    // 1. Generate the shareable URL.
    const result = await createShareLink({ coinNumber });

    if ("error" in result || !result.data) {
      toast.error("Could not generate share link. Please try again.");
      showFeedback("error");
      return;
    }

    const url = result.data;

    // 2a. Web Share API path (mobile-first, progressive enhancement).
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(buildShareData(url));
        showFeedback("shared");
        return;
      } catch (shareError) {
        // User cancelled the share sheet — not a real error, just fall through.
        // AbortError is the expected error when the user dismisses the sheet.
        const isAbort =
          shareError instanceof DOMException && shareError.name === "AbortError";
        if (isAbort) return; // Silent no-op; user deliberately cancelled.
        // Any other error: fall back to clipboard.
      }
    }

    // 2b. Copy-link fallback.
    await copyToClipboard(url);
  };

  // ── Derived display values ─────────────────────────────────────────────────

  const isLoading = isCreatingLink;

  const iconNode = isLoading ? (
    <Loader2 className="animate-spin" aria-hidden="true" />
  ) : feedback === "copied" || feedback === "shared" ? (
    <Check aria-hidden="true" />
  ) : feedback === "error" ? (
    <Link aria-hidden="true" />
  ) : (
    <Share2 aria-hidden="true" />
  );

  const visibleLabel =
    feedback === "copied"
      ? "Copied!"
      : feedback === "shared"
        ? "Shared!"
        : feedback === "error"
          ? "Error"
          : isLoading
            ? "Sharing…"
            : label;

  // Accessible label always includes context even in icon-only mode.
  const ariaLabel = iconOnly
    ? `Share LoveCoin #${coinNumber}`
    : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={isLoading}
      onClick={handleShare}
      aria-label={ariaLabel}
      aria-live="polite"
      className={cn(
        "transition-all",
        feedback === "copied" || feedback === "shared"
          ? "border-green-500/40 text-green-600"
          : "",
        feedback === "error" ? "border-destructive/40 text-destructive" : "",
        className,
      )}
    >
      {iconNode}
      {!iconOnly && <span>{visibleLabel}</span>}
    </Button>
  );
}
