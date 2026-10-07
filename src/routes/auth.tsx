import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useLove } from "@/lib/store";

const TITLE = "Sign in — LoveCoin";
const DESC =
  "Sign in to keep your LoveCoins, LoveNotes and reactions safe on every device you use.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { currentUser } = useLove();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && pathname === "/auth") {
      void navigate({ to: "/my-lovecoins", replace: true });
    }
  }, [currentUser, navigate, pathname]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: displayName.trim() || email.split("@")[0] },
        },
      });
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      if (!data.session) {
        setNotice("Check your email to confirm your address, then come back and sign in.");
      }
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) setError(err.message);
  };

  const googleSignIn = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("We couldn't reach Google just then. Please try again.");
    }
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

      <button type="button" onClick={googleSignIn} className="btn-base btn-ghosted mt-8 w-full">
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[0.62rem] tracking-[0.25em] text-muted-foreground uppercase">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-4">
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
          />
        </div>

        {error ? <p className="text-sm text-primary">{error}</p> : null}
        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

        <button type="submit" disabled={busy} className="btn-base btn-primary w-full disabled:opacity-50">
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create my account"}
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
