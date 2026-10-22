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
import { toast } from "sonner";
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
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      supabase.auth.getSession().catch(() => {
        toast.error("We couldn't complete your sign-in. Please try again.");
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
      toast.error(decodeURIComponent(oauthError));
    }
  }, [oauthError]);

  // ---------------------------------------------------------------------------
  // Session expiry notice (Requirements 18.5, 20.4, 21.20)
  // Arriving with ?reason=expired means the 401 interceptor forced logout.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (reason === "expired") {
      toast.error("Your session has expired. Please sign in again.");
    }
  }, [reason]);

  // ---------------------------------------------------------------------------
  // Form submission (email sign-in / sign-up)
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (mode === "signup") {
      const result = await signUpWithEmail({
        email: email.trim(),
        password,
        displayName: displayName.trim() || email.split("@")[0] || email,
      });

      if ("error" in result) {
        const err = result.error as { message?: string } | undefined;
        toast.error(err?.message ?? "Sign up failed. Please try again.");
        return;
      }

      // Supabase sends a confirmation email for new sign-ups; no session yet.
      toast.success("Check your email to confirm your address, then come back and sign in.", {
        duration: 8000,
      });
      return;
    }

    // Sign in with email + password
    const result = await signInWithEmail({
      email: email.trim(),
      password,
    });

    if ("error" in result) {
      const err = result.error as { message?: string } | undefined;
      toast.error(err?.message ?? "Sign in failed. Please check your email and password.");
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
    // The OAuth callback must land on /auth so this component can parse the
    // session from the URL hash. Pass the original `redirectTo` through as a
    // query param so we can forward it after the session is established.
    const callbackUrl = new URL(`${window.location.origin}/auth`);
    if (redirectTo) {
      callbackUrl.searchParams.set("redirectTo", redirectTo);
    }

    const result = await signInWithGoogle({ redirectTo: callbackUrl.toString() });

    if ("error" in result) {
      toast.error("We couldn't reach Google just then. Please try again.");
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
        className="btn-base btn-ghosted mt-8 w-full justify-center disabled:opacity-50"
      >
        {/* Google "G" logo */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          className="mr-2 shrink-0"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
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
          }}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
