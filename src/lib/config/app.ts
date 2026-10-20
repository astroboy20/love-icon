/**
 * Application configuration.
 *
 * Centralises bucket names, Edge Function URLs, and Bachs payment URLs so
 * they are never scattered across feature files. All client-visible config
 * reads from `VITE_*` environment variables; server-side secrets (API keys,
 * webhook secrets, service-role key) must never appear here.
 *
 * Requirements: 1.1, 4.1
 */

// ---------------------------------------------------------------------------
// Supabase Storage bucket names
// Matches the buckets created in migration 0003_storage_buckets.sql
// ---------------------------------------------------------------------------

export const STORAGE_BUCKETS = {
  /** Public bucket for LoveCoin photos. */
  coinPhotos: "coin-photos",
  /** Public bucket for LoveNote photos. */
  notePhotos: "note-photos",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

// ---------------------------------------------------------------------------
// Supabase Edge Function paths
// These are relative paths appended to the Supabase Functions base URL,
// which the Supabase JS client resolves automatically via `supabase.functions.invoke`.
// ---------------------------------------------------------------------------

export const EDGE_FUNCTIONS = {
  /** Creates a Bachs Pure Checkout session server-side. */
  createBachsCheckout: "create-bachs-checkout",
  /** Receives and verifies Bachs webhook events. */
  bachsWebhook: "bachs-webhook",
} as const;

// ---------------------------------------------------------------------------
// Bachs payment URLs
// These VITE_ variables are safe to expose to the browser — they are simply
// redirect destinations, not secrets. The actual Bachs API key lives in the
// Edge Function environment and is never sent to the client.
// ---------------------------------------------------------------------------

function readEnv(key: string, fallback: string): string {
  // `import.meta.env` is available in Vite/TanStack Start client bundles.
  // On the server side (SSR) `process.env` is used as a fallback.
  return (
    (typeof import.meta !== "undefined" && (import.meta.env as Record<string, string>)?.[key]) ||
    (typeof process !== "undefined" && process.env[key]) ||
    fallback
  );
}

export const PAYMENT_CONFIG = {
  /**
   * URL Bachs redirects to after a successful payment.
   * Should include a route that polls the purchase order status.
   * Example: https://lovecoin.app/payment/success
   */
  returnUrl: readEnv("VITE_BACHS_RETURN_URL", "/payment/success"),

  /**
   * URL Bachs redirects to when the user cancels payment.
   * Example: https://lovecoin.app/payment/cancel
   */
  cancelUrl: readEnv("VITE_BACHS_CANCEL_URL", "/payment/cancel"),
} as const;

// ---------------------------------------------------------------------------
// File upload constraints (mirrors Supabase Storage policy settings)
// ---------------------------------------------------------------------------

export const UPLOAD_CONSTRAINTS = {
  /** Maximum allowed upload size in bytes (5 MB). */
  maxFileSizeBytes: 5 * 1024 * 1024,
  /** Accepted image MIME types for both coin and note photos. */
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
} as const;

export type AcceptedMimeType = (typeof UPLOAD_CONSTRAINTS.acceptedMimeTypes)[number];
