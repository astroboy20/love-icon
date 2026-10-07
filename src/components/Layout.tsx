import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useLove } from "@/lib/store";

const NAV = [
  { to: "/explore", label: "Explore" },
  { to: "/love-of-fame", label: "Love of Fame" },
  { to: "/how-it-works", label: "How It Works" },
] as const;

const MOBILE_NAV = [
  { to: "/", label: "Home", icon: "◈" },
  { to: "/explore", label: "Heart", icon: "♥" },
  { to: "/love-of-fame", label: "Love of Fame", icon: "✦" },
  { to: "/my-lovecoins", label: "My Coins", icon: "◎" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { currentUser, signOut } = useLove();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/", replace: true });
  };

  return (
    <div className="page-wash min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link to="/" className="font-display text-xl tracking-[0.18em] text-primary uppercase">
            Lovecoin
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                activeProps={{ className: "text-primary" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <Link
                  to="/my-lovecoins"
                  className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-primary md:block"
                >
                  {currentUser.display_name}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-primary md:block"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-primary md:block"
              >
                Sign in
              </Link>
            )}
            <Link to="/explore" className="btn-base btn-primary !px-4 !py-2 !text-[0.8rem]">
              Claim a LoveCoin
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-28 md:pb-0">{children}</main>

      <footer className="hidden border-t border-border/60 py-12 md:block">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-8 text-center">
          <p className="font-display text-2xl text-primary">
            Spreading love, one coin at a time.
          </p>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Keep love · Share love · Celebrate love
          </p>
        </div>
      </footer>

      <nav className="glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border/60 pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-1 py-3 text-[0.65rem] font-medium tracking-wide text-muted-foreground"
            activeProps={{ className: "!text-primary" }}
            activeOptions={{ exact: item.to === "/" }}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
