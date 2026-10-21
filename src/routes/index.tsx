import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useGetCoinsQuery } from "@/features/coins/api/coinsApi";
import { useGetNotesQuery } from "@/features/fame/api/fameApi";
import { ClaimFlow } from "@/features/coins/components/ClaimFlow";
import { HeartGrid } from "@/components/HeartGrid";
import { CoinVisual } from "@/components/CoinVisual";
import { formatNumber } from "@/lib/format";
import { TOTAL_COINS } from "@/lib/types";

const TITLE = "LoveCoin — Give love a little place to live";
const DESC =
  "Claim a tiny piece of the internet, fill it with something meaningful, and keep it forever. One billion little spaces for love.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: coins = [] } = useGetCoinsQuery();
  const { data: notes = [] } = useGetNotesQuery();
  const navigate = useNavigate();
  const featured = coins.slice(0, 3);
  const claimedCount = coins.length;

  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pt-16 pb-10 text-center md:px-8 md:pt-28">
        <p className="animate-rise text-[0.7rem] tracking-[0.35em] text-muted-foreground uppercase">
          Spreading love, one coin at a time
        </p>
        <h1 className="animate-rise font-display text-balance-tight mt-6 text-[3.1rem] leading-[0.95] text-primary md:text-[5.5rem]">
          Give love a little place to live.
        </h1>
        <p className="animate-rise mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
          Claim a tiny piece of the internet, fill it with something meaningful, and keep it
          forever.
        </p>
        <div className="animate-rise mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/explore" className="btn-base btn-primary">
            Claim a LoveCoin ❤️
          </Link>
          <Link to="/love-of-fame" className="btn-base btn-ghosted">
            Explore Love of Fame
          </Link>
        </div>

        <div className="mt-16">
          <p className="font-display text-[2.6rem] leading-none text-primary md:text-6xl">
            1,000,000,000
          </p>
          <p className="mt-2 text-xs tracking-[0.35em] text-muted-foreground uppercase">
            LoveCoins
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            One billion little spaces for love.
          </p>
        </div>
      </section>

      <section className="px-4 pb-6 md:px-8">
        <HeartGrid />
        <div className="mx-auto mt-8 max-w-md text-center">
          <p className="font-display text-3xl text-primary">
            {formatNumber(claimedCount)} LoveCoins claimed
          </p>
          <p className="mt-1 text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {formatNumber(claimedCount)} / {formatNumber(TOTAL_COINS)}
          </p>
          <div className="mx-auto mt-4 h-[3px] w-56 overflow-hidden rounded-full bg-border">
            <div className="h-full w-[6%] rounded-full bg-primary" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Tap any coin in the heart to open it or make it yours.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 md:px-8">
        <div className="mb-10 text-center">
          <h2 className="font-display text-4xl text-primary md:text-5xl">Recently kept</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A little piece of the internet, kept for someone you love.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {featured.map((coin) => (
            <button
              key={coin.coin_number}
              onClick={() =>
                navigate({
                  to: "/coin/$coinNumber",
                  params: { coinNumber: String(coin.coin_number) },
                })
              }
              className="group flex flex-col items-center gap-4 rounded-[1.75rem] p-6 text-center transition-transform hover:-translate-y-1"
            >
              <CoinVisual
                style={coin.style as import("@/lib/types").CoinStyle}
                coinNumber={coin.coin_number}
                creator=""
                recipient=""
                imageUrl={null}
                size={168}
              />
            </button>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-[oklch(0.99_0.006_80)] py-20">
        <div className="mx-auto max-w-5xl px-5 text-center md:px-8">
          <h2 className="font-display text-4xl text-primary md:text-5xl">Where love is shared.</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            A LoveCoin is something you keep. A LoveNote is something you share. Love of Fame is
            where {formatNumber(notes.length)} moments of love live right now.
          </p>
          <Link to="/love-of-fame" className="btn-base btn-primary mt-8">
            How did you give or receive love today?
          </Link>
        </div>
      </section>

      <ClaimFlow />
    </>
  );
}
