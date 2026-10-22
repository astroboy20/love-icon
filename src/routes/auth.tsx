/**
 * Authentication route (/auth)
 *
 * Handles:
 *   - Email/password sign-in and sign-up
 *   - Google OAuth sign-in (with post-auth redirect back to the originating page)
 *   - OAuth redirect landing: parse the session from the URL hash/fragment so
 *     Supabase can hydrate the session (Supabase JS does this automatically when
 *     `detectSessionInUrl` is true, which is the default). The `onAuthStateChange`
 *     listener in `useAuthInit` fires once the session is parsed, dispatching
 *     `setCurrentUser`, which triggers the navigate-away effect below.
 *   - OAuth error parameters surfaced in URL query params (e.g. "access_denied")
 *   - Post-auth navigation: redirect to `?redirectTo=` if present, otherwise
 *     to /my-lovecoins (Requirements 14.4, 14.5)
 *   - Session expiry message when landing with `?reason=expired` (Req 18.5, 21.20)
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 18.5, 20.4, 21.20
 */
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useSignInWithGoogleMutation,
  useSignInWithEmailMutation,
  useSignUpWithEmailMutation,
} from "@/features/auth/api/authApi";
import { useAppSelector } from "@/app/store";
import { selectCurrentUser } from "@/features/auth/slices/authSlice";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const TITLE = "Sign in — LoveCoin";
const DESC =
  "Sign in to keep your LoveCoins, LoveNotes and reactions safe on every device you use.";

// ---------------------------------------------------------------------------
// Route search-param schema
// ---------------------------------------------------------------------------
// `redirectTo`        — page to navigate to after successful auth
// `reason`            — "expired" when arriving from the 401 interceptor
// `error`             — OAuth error code (e.g. "access_denied")
// `error_description` — human-readable OAuth error detail
const searchSchema = z.object({
  redirectTo: z.string().optional(),
  reason: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const currentUser = useAppSelector(selectCurrentUser);
  const navigate = useNavigate();

  // Read typed search params
  const search = useSearch({ from: "/auth" });
  const redirectTo = search.redirectTo;
  const reason = search.reason;

  // OAuth errors surfaced in URL query params (provider denied access, etc.)
  const oauthError = search.error_description ?? search.error ?? null;

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // RTK Query mutations
  const [signInWithGoogle, { isLoading: isGoogleLoading }] = useSignInWithGoogleMutation();
  const [signInWithEmail, { isLoading: isEmailSignInLoading }] = useSignInWithEmailMutation();
  const [signUpWithEmail, { isLoading: isSignUpLoading }] = useSignUpWithEmailMutation();

  const busy = isGoogleLoading || isEmailSignInLoading || isSignUpLoading;

  // ---------------------------------------------------------------------------
  // OAuth redirect landing — parse the session from the URL hash.
  //
  // When Supabase redirects back from Google OAuth, the access token is
  // embedded in the URL fragment (#access_token=...&refresh_token=...).
  // Supabase JS automatically detects and exchanges the token when
  // `detectSessionInUrl` is true (the default), but we call
  // `getSessionFromUrl` explicitly here to:
  //   1. Trigger the exchange immediately on mount rather than waiting for the
  //      next auth state change listener tick.
  //   2. Surface any URL-level errors (e.g. missing token) as a user-visible
  //      message (Requirement 14.3).
  //
  // The resulting session is picked up by `onAuthStateChange` in `useAuthInit`,
  // which dispatches `setCurrentUser`, which triggers the navigate-away effect.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Only attempt to parse the URL hash when the fragment contains an
    // access_token — avoids unnecessary calls on plain /auth page loads.
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      supabase.auth.getSession().catch(() => {
        // If the token in the hash is malformed or already consumed, surface
        // a generic error — the user can just sign in again.
        setError("We couldn't complete your sign-in. Please try again.");
      });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Post-auth navigation (Requirements 14.4, 14.5)
  //
  // When `currentUser` becomes non-null (set by `useAuthInit` via
  // `setCurrentUser` on the `onAuthStateChange` event), navigate away from the
  // auth page:
  //   - To `redirectTo` if that param is present (Req 14.4)
  //   - Otherwise to /my-lovecoins (Req 14.5)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentUser) {
      if (redirectTo) {
        // `window.location.replace` avoids TS route-type constraints and
        // supports arbitrary paths including /explore, /coin/:n, etc.
        window.location.replace(redirectTo);
      } else {
        void navigate({ to: "/my-lovecoins", replace: true });
      }
    }
  }, [currentUser, navigate, redirectTo]);

  // ---------------------------------------------------------------------------
  // OAuth error params (Requirement 14.3)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
    }
  }, [oauthError]);

  // ---------------------------------------------------------------------------
  // Session expiry notice (Requirements 18.5, 20.4, 21.20)
  // Arriving with ?reason=expired means the 401 interceptor forced logout.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (reason === "expired") {
      setError("Your session has expired. Please sign in again.");
    }
  }, [reason]);

  // ---------------------------------------------------------------------------
  // Form submission (email sign-in / sign-up)
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      const result = await signUpWithEmail({
        email: email.trim(),
        password,
        displayName: displayName.trim() || email.split("@")[0] || email,
      });

      if ("error" in result) {
        const err = result.error as { message?: string } | undefined;
        setError(err?.message ?? "Sign up failed. Please try again.");
        return;
      }

      // Supabase sends a confirmation email for new sign-ups; no session yet.
      setNotice("Check your email to confirm your address, then come back and sign in.");
      return;
    }

    // Sign in with email + password
    const result = await signInWithEmail({
      email: email.trim(),
      password,
    });

    if ("error" in result) {
      const err = result.error as { message?: string } | undefined;
      setError(err?.message ?? "Sign in failed. Please check your email and password.");
    }
    // On success, the `useAuthInit` hook picks up the session change and
    // dispatches `setCurrentUser`, which triggers the navigate-away effect.
  };

  // ---------------------------------------------------------------------------
  // Google OAuth sign-in (Requirements 14.1, 14.2)
  //
  // Build the OAuth `redirectTo` so that after Google authenticates the user,
  // Supabase redirects back to `/auth` (this page) with the session hash and,
  // optionally, the `redirectTo` query param preserved so the navigate-away
  // effect above can forward the user to the right page.
  // ---------------------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    setError(null);

    // The OAuth callback must land on /auth so this component can parse the
    // session from the URL hash. Pass the original `redirectTo` through as a
    // query param so we can forward it after the session is established.
    const callbackUrl = new URL(`${window.location.origin}/auth`);
    if (redirectTo) {
      callbackUrl.searchParams.set("redirectTo", redirectTo);
    }

    const result = await signInWithGoogle({ redirectTo: callbackUrl.toString() });

    if ("error" in result) {
      setError("We couldn't reach Google just then. Please try again.");
    }
    // On success the browser is redirected to Google; no further action here.
  };

  return (
    <div className="mx-auto max-w-md px-5 py-16 md:py-24">
      <div className="text-center">
        <p className="text-[0.7rem] tracking-[0.35em] text-muted-foreground uppercase">Lovecoin</p>
        <h1 className="font-display text-balance-tight mt-4 text-4xl text-primary md:text-5xl">
          {mode === "signin" ? "Welcome back." : "Keep love, everywhere."}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your LoveCoins and LoveNotes stay with you on every device.
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={busy}
        className="btn-base btn-ghosted mt-8 w-full disabled:opacity-50"
      >
        {isGoogleLoading ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[0.62rem] tracking-[0.25em] text-muted-foreground uppercase">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" ? (
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="display-name">
              Your name
            </label>
            <input
              id="display-name"
              className="field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Simi"
              autoComplete="name"
              disabled={busy}
            />
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={busy}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            disabled={busy}
          />
        </div>

        {error ? <p className="text-sm text-primary">{error}</p> : null}
        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="btn-base btn-primary w-full disabled:opacity-50"
        >
          {busy
            ? "One moment…"
            : mode === "signin"
              ? "Sign in"
              : "Create my account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="text-primary underline underline-offset-4"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
