/**
 * Shared RTK Query base query for Supabase.
 *
 * Every RTK Query API slice passes a `queryFn` that calls Supabase directly,
 * but they all share this error-interception layer:
 *
 *  - Injects the current Supabase auth token so requests are authenticated.
 *  - Intercepts 401 / PGRST301 errors, dispatches `markSessionExpired()`,
 *    and redirects the browser to /auth?reason=expired so the user is never
 *    silently stuck with a dead session.
 *
 * Usage in an API slice:
 *
 *   import { supabaseBaseQuery } from "@/lib/api/supabaseBaseQuery";
 *
 *   export const coinsApi = createApi({
 *     reducerPath: "coinsApi",
 *     baseQuery: supabaseBaseQuery,
 *     endpoints: (build) => ({
 *       getCoins: build.query({
 *         queryFn: async () => {
 *           const { data, error } = await supabase.from("lovecoins").select("...");
 *           if (error) return { error };
 *           return { data };
 *         },
 *       }),
 *     }),
 *   });
 *
 * Requirements: 22.3, 22.10, 18.5, 21.20
 */
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The argument passed to each `queryFn`. Because individual endpoints define
 * their own `queryFn` bodies, the base query itself receives no meaningful
 * runtime argument — it exists purely for error interception and auth
 * injection.
 *
 * Endpoints should import `supabase` directly inside their `queryFn` and
 * return `{ data }` or `{ error }`.
 */
export type SupabaseBaseQueryArg = void;

/** Normalised error shape returned to RTK Query on failure. */
export interface SupabaseQueryError {
  /** HTTP status code or Supabase PostgREST error code. */
  status: number | string;
  /** Human-readable error message. */
  message: string;
  /** Original error code from Supabase / PostgREST (e.g. "PGRST301"). */
  code?: string;
}

// ---------------------------------------------------------------------------
// Session-expiry action type
// ---------------------------------------------------------------------------

// This string must match the action type produced by authSlice.markSessionExpired().
// Defined as a constant here to avoid a circular import with the auth feature.
const MARK_SESSION_EXPIRED_ACTION = "auth/markSessionExpired";

// ---------------------------------------------------------------------------
// Error classification helpers
// ---------------------------------------------------------------------------

function isSessionExpiredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  // HTTP 401 from PostgREST
  if (e["status"] === 401) return true;
  // PGRST301 = JWT expired
  if (e["code"] === "PGRST301") return true;
  return false;
}

function normaliseError(error: unknown): SupabaseQueryError {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const code = e["code"] as string | undefined;
    return {
      status: (e["status"] as number | string | undefined) ?? "UNKNOWN",
      message: (e["message"] as string | undefined) ?? "An unexpected error occurred.",
      // Only spread `code` when it's defined — exactOptionalPropertyTypes
      // disallows explicitly setting an optional property to `undefined`.
      ...(code !== undefined && { code }),
    };
  }
  return { status: "UNKNOWN", message: String(error) };
}

// ---------------------------------------------------------------------------
// Base query
// ---------------------------------------------------------------------------

/**
 * `supabaseBaseQuery` is the RTK Query `baseQuery` shared by every feature
 * API slice. It does not execute any Supabase calls itself — endpoint authors
 * do that inside their `queryFn`. Its sole job is:
 *
 * 1. Ensure the Supabase JS client has a valid session token before each
 *    request (the client manages token refresh automatically, but calling
 *    `getSession` here lets us detect an already-expired session before
 *    the network round-trip).
 * 2. Intercept 401 / PGRST301 errors from the Supabase PostgREST layer and
 *    dispatch `markSessionExpired()` so the UI can redirect to the auth page.
 *
 * Each endpoint's `queryFn` is responsible for returning `{ data }` or
 * `{ error }` from its Supabase call. Errors are normalised into
 * `SupabaseQueryError` before being returned to RTK Query.
 */
export const supabaseBaseQuery: BaseQueryFn<
  SupabaseBaseQueryArg,
  unknown,
  SupabaseQueryError
> = async (_arg, api) => {
  // Step 1 — ensure the session is still valid before the query proceeds.
  // The Supabase client will auto-refresh the token if it has a valid
  // refresh token; if not, `getSession` returns null and we catch the
  // expired state here rather than after a failed network call.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    const normalisedError = normaliseError(sessionError);
    if (isSessionExpiredError(normalisedError)) {
      api.dispatch({ type: MARK_SESSION_EXPIRED_ACTION });
      if (typeof window !== "undefined") {
        window.location.href = "/auth?reason=expired";
      }
    }
    return { error: normalisedError };
  }

  // If there is no active session the endpoint may still proceed for
  // public/unauthenticated queries (e.g. reading public coins). Individual
  // endpoints are responsible for guarding authenticated-only operations.
  void sessionData;

  // Step 2 — the base query itself returns a no-op success. Each endpoint
  // defines its own `queryFn` which calls Supabase directly. The middleware
  // defined at the store level ensures RTK Query's internal subscriptions
  // and cache machinery still function correctly.
  return { data: null };
};

// ---------------------------------------------------------------------------
// Shared error interception utility for individual queryFn authors.
//
// Call `interceptSupabaseError(error, api.dispatch)` inside a `queryFn`
// catch block so that 401 / PGRST301 errors trigger the session-expiry flow
// even when the error originates deep inside an endpoint.
// ---------------------------------------------------------------------------

/**
 * Intercept a Supabase error, dispatch session-expiry if needed, and return
 * a normalised `SupabaseQueryError` ready to return from a `queryFn`.
 *
 * @example
 * ```ts
 * queryFn: async (_arg, { dispatch }) => {
 *   const { data, error } = await supabase.from("lovecoins").select("*");
 *   if (error) return { error: interceptSupabaseError(error, dispatch) };
 *   return { data };
 * }
 * ```
 */
export function interceptSupabaseError(
  error: unknown,
  dispatch: (action: unknown) => void,
): SupabaseQueryError {
  const normalisedError = normaliseError(error);

  if (isSessionExpiredError(normalisedError)) {
    dispatch({ type: MARK_SESSION_EXPIRED_ACTION });
    if (typeof window !== "undefined") {
      window.location.href = "/auth?reason=expired";
    }
  }

  return normalisedError;
}
