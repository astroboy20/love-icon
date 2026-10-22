import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useSignInWithGoogleMutation,
  useSignInWithEmailMutation,
  useSignUpWithEmailMutation,
} from "@/features/auth/api/authApi";
import { useAppSelector } from "@/app/store";
import { selectCurrentUser } from "@/features/auth/slices/authSlice";
import { z } from "zod";

const TITLE = "Sign in — LoveCoin";
const DESC =
  "Sign in to keep your LoveCoins, LoveNotes and reactions safe on every device you use.";

// Search params: optional `redirectTo` for post-auth redirect
const searchSchema = z.object({
  redirectTo: z.string().optional(),
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

  // Read search params via TanStack Router's typed useSearch
  const search = useSearch({ from: "/auth" });
  const redirectTo = search.redirectTo;
  // OAuth error passed back in URL query params (e.g. provider denied access)
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

  // When auth state is populated (sign-in succeeded), navigate away.
  // Priority: redirectTo param → /my-lovecoins
  useEffect(() => {
    if (currentUser) {
      if (redirectTo) {
        // Use window.location for arbitrary redirectTo paths to avoid TS
        // route-type constraints on navigate({ to }).
        window.location.replace(redirectTo);
      } else {
        void navigate({ to: "/my-lovecoins", replace: true });
      }
    }
  }, [currentUser, navigate, redirectTo]);

  // Show OAuth error surfaced in URL params (e.g. "access_denied")
  useEffect(() => {
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
    }
  }, [oauthError]);

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
    // On success, the useAuthInit hook picks up the session change and
    // dispatches setCurrentUser, which triggers the useEffect above to navigate.
  };

  const handleGoogleSignIn = async () => {
    setError(null);

    // Build the redirect URL so Supabase returns the user to this page
    // (which then navigates to redirectTo or /my-lovecoins via the useEffect).
    const redirectUri = `${window.location.origin}/auth${
      redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""
    }`;

    const result = await signInWithGoogle({ redirectTo: redirectUri });

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
