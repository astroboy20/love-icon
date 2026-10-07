import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HeartGrid } from "@/components/HeartGrid";
import { ClaimFlow } from "@/components/ClaimFlow";
import { useLove } from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { TOTAL_COINS } from "@/lib/types";

const TITLE = "Explore the Billion-Coin Heart — LoveCoin";
const DESC =
  "One billion little spaces for love, arranged into a single heart. Find an open LoveCoin and make it yours for ₦100.";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Explore,
});

function Explore() {
  const { claimedCount } = useLove();
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 md:px-8 md:py-20">
      <div className="text-center">
        <p className="text-[0.7rem] tracking-[0.35em] text-muted-foreground uppercase">
          The Billion-Coin Heart
        </p>
        <h1 className="font-display text-balance-tight mt-4 text-5xl text-primary md:text-6xl">
          A monument made of small loves.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
          Every dot is a LoveCoin. Soft ones are still waiting. Glowing ones already belong to
          someone.
        </p>
      </div>

      <div className="mt-12">
        <HeartGrid onSelect={setSelected} />
      </div>

      <div className="mt-10 text-center">
        <p className="font-display text-3xl text-primary">
          {formatNumber(claimedCount)} LoveCoins claimed
        </p>
        <p className="mt-1 text-xs tracking-[0.2em] text-muted-foreground uppercase">
          {formatNumber(claimedCount)} / {formatNumber(TOTAL_COINS)}
        </p>
      </div>

      <ClaimFlow coinNumber={selected} open={selected !== null} onClose={() => setSelected(null)} />
    </div>
  );
}
