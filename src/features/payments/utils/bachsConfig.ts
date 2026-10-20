/**
 * Bachs payment gateway configuration.
 *
 * These values are read from environment variables but are NOT secrets — they
 * are simply URLs that the client needs to know about for redirects and Edge
 * Function invocation. The actual secrets (BACHS_API_KEY, BACHS_WEBHOOK_SECRET)
 * are stored as Edge Function environment variables and never exposed to the browser.
 *
 * Requirements: 4.1, 21.18
 */

import { EDGE_FUNCTIONS, PAYMENT_CONFIG } from "@/lib/config/app";

/**
 * Read an environment variable with a fallback.
 * Works in both client (Vite) and server (Node/Deno) environments.
 */
function readEnv(key: string, fallback: string): string {
  return (
    (typeof import.meta !== "undefined" && (import.meta.env as Record<string, string>)?.[key]) ||
    (typeof process !== "undefined" && process.env[key]) ||
    fallback
  );
}

/**
 * Bachs API base URL (default: https://api.bachs.co).
 * Only used server-side in Edge Functions; included here for completeness.
 */
export const BACHS_BASE_URL = readEnv("BACHS_BASE_URL", "https://api.bachs.co");

/**
 * Supabase Edge Function name for creating a Bachs checkout session.
 * Invoked via `supabase.functions.invoke(BACHS_CHECKOUT_EDGE_FUNCTION, ...)`.
 */
export const BACHS_CHECKOUT_EDGE_FUNCTION = EDGE_FUNCTIONS.createBachsCheckout;

/**
 * Supabase Edge Function name for receiving Bachs webhook events.
 * This is the webhook endpoint URL registered in the Bachs dashboard.
 */
export const BACHS_WEBHOOK_EDGE_FUNCTION = EDGE_FUNCTIONS.bachsWebhook;

/**
 * URL Bachs redirects to after a successful payment.
 * Configured via VITE_BACHS_RETURN_URL (safe to expose to browser).
 */
export const BACHS_RETURN_URL = PAYMENT_CONFIG.returnUrl;

/**
 * URL Bachs redirects to when the user cancels payment.
 * Configured via VITE_BACHS_CANCEL_URL (safe to expose to browser).
 */
export const BACHS_CANCEL_URL = PAYMENT_CONFIG.cancelUrl;
