import { createFileRoute, Link } from "@tanstack/react-router";
import { CoinVisual } from "@/components/CoinVisual";
import { useGetMyCoinsQuery, useGetReceivedCoinsQuery } from "@/features/coins/api/coinsApi";
import { useGetNotesQuery } from "@/features/fame/api/fameApi";
import { useAppSelector } from "@/app/store";
import { selectCurrentUser } from "@/features/auth/slices/authSlice";
import { ProfileEditor } from "@/features/auth/components/ProfileEditor";
import { ReceivedCoinsSection } from "@/features/coins/components/ReceivedCoinsSection";
import { formatDate } from "@/lib/format";
import type { ReactNode } from "react";

const TITLE = "My LoveCoins — your kept moments";
const DESC =
  "The LoveCoins you've created, the ones you've received, and the LoveNotes you've shared.";

export const Route = createFileRoute("/my-lovecoins")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: MyLoveCoins,
});

function MyLoveCoins() {
  const currentUser = useAppSelector(selectCurrentUser);
  const { data: myCoins = [] } = useGetMyCoinsQuery(undefined, { skip: !currentUser });
  const { data: notes = [] } = useGetNotesQuery(undefined, { skip: !currentUser });
  const mine = currentUser ? notes.filter((n) => n.user_id === currentUser.id) : [];

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center md:py-32">
        <h1 className="font-display text-5xl text-primary">My LoveCoins</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Sign in to see everything you've kept and shared — on any device.
        </p>
        <Link to="/auth" className="btn-base btn-primary mt-8">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-14 md:px-8 md:py-20">
      <h1 className="font-display text-5xl text-primary md:text-6xl">My LoveCoins</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Everything you've kept and everything you've shared.
      </p>

      {/* Profile editor */}
      <div className="mt-8">
        <ProfileEditor />
      </div>

      <Section title="Coins I've created" empty="You haven't kept a moment yet.">
        {myCoins.map((c) => (
          <Link
            key={c.id}
            to="/coin/$coinNumber"
            params={{ coinNumber: String(c.coin_number) }}
            className="flex flex-col items-center gap-3 rounded-[1.5rem] p-4 text-center transition-transform hover:-translate-y-1"
          >
            <CoinVisual
              style={c.style as import("@/lib/types").CoinStyle}
              coinNumber={c.coin_number}
              creator={c.creator_name}
              recipient={c.recipient_name}
              imageUrl={c.image_url}
              size={140}
            />
            <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
          </Link>
        ))}
      </Section>

      {/* Received coins uses the dedicated RTK Query component */}
      <ReceivedCoinsSection />

      <section className="mt-16">
        <h2 className="font-display text-3xl text-primary">LoveNotes I've shared</h2>
        {mine.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            You haven't shared a LoveNote yet.{" "}
            <Link to="/love-of-fame" className="text-primary underline underline-offset-4">
              Start one
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {mine.map((n) => (
              <li
                key={n.id}
                className="rounded-2xl border border-border/70 bg-card/70 p-5 text-sm leading-relaxed"
              >
                <span className="text-[0.62rem] tracking-[0.2em] text-muted-foreground uppercase">
                  {n.love_type === "gave" ? "I gave love" : "I received love"} · {n.category}
                </span>
                <p className="font-display mt-2 text-xl">"{n.content}"</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-16 rounded-[2rem] bg-secondary/70 p-8 text-center">
        <p className="font-display text-3xl text-primary">Keep another moment.</p>
        <Link to="/explore" className="btn-base btn-primary mt-5">
          Claim a LoveCoin ❤️
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <section className="mt-14">
      <h2 className="font-display text-3xl text-primary">{title}</h2>
      {children.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">{children}</div>
      )}
    </section>
  );
}
