import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CoinVisual } from "@/components/CoinVisual";
import { LoveNoteComposer } from "@/components/LoveNoteComposer";
import { useLove } from "@/lib/store";
import { coinLabel, formatDate } from "@/lib/format";

export const Route = createFileRoute("/coin/$coinNumber")({
  head: ({ params }) => {
    const title = `LoveCoin #${String(params.coinNumber).padStart(8, "0")} — LoveCoin`;
    const description = "A little piece of the internet, kept for someone you love.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CoinPage,
});

function Hearts() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="absolute bottom-1/3 left-1/2 text-lg"
          style={{
            // @ts-expect-error custom property
            "--dx": `${(i - 5) * 26}px`,
            animation: `float-heart ${2.4 + i * 0.15}s ease-out ${i * 0.09}s forwards`,
          }}
        >
          ❤️
        </span>
      ))}
    </div>
  );
}

function CoinPage() {
  const { coinNumber } = Route.useParams();
  const { coinByNumber, ready } = useLove();
  const navigate = useNavigate();
  const coin = coinByNumber(Number(coinNumber));
  const [copied, setCopied] = useState(false);
  const [composer, setComposer] = useState(false);
  const [celebrate, setCelebrate] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setCelebrate(false), 2600);
    return () => clearTimeout(t);
  }, []);

  if (!coin) {
    return (
      <div className="mx-auto max-w-md px-5 py-28 text-center">
        <h1 className="font-display text-4xl text-primary">
          {ready ? "This LoveCoin is still empty." : "Opening…"}
        </h1>
        {ready ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              {coinLabel(Number(coinNumber))} hasn't been claimed yet. It could be yours.
            </p>
            <Link to="/explore" className="btn-base btn-primary mt-7">
              Claim a LoveCoin ❤️
            </Link>
          </>
        ) : null}
      </div>
    );
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `${coin.creator_name} made a LoveCoin for ${coin.recipient_name}.`;

  return (
    <div className="relative mx-auto max-w-2xl px-5 py-16 text-center md:py-24">
      {celebrate ? <Hearts /> : null}

      <div className="flex justify-center">
        <CoinVisual
          style={coin.style}
          coinNumber={coin.coin_number}
          creator={coin.creator_name}
          recipient={coin.recipient_name}
          imageUrl={coin.image_url}
          size={260}
          animate
        />
      </div>

      <h1 className="font-display mt-10 text-4xl text-primary md:text-5xl">
        {coinLabel(coin.coin_number)}
      </h1>
      <p className="mt-3 text-sm tracking-[0.18em] text-muted-foreground uppercase">
        Created by {coin.creator_name} for {coin.recipient_name}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{formatDate(coin.created_at)}</p>

      {coin.message ? (
        <p className="font-display mx-auto mt-10 max-w-xl text-3xl leading-snug text-foreground md:text-[2.2rem]">
          “{coin.message}”
        </p>
      ) : null}

      {coin.image_url ? (
        <img
          src={coin.image_url}
          alt={`A photo kept on the LoveCoin for ${coin.recipient_name}`}
          className="mx-auto mt-10 max-h-[26rem] w-full rounded-[1.75rem] object-cover shadow-[var(--shadow-soft)]"
        />
      ) : null}

      <div className="mt-14">
        <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
          Share this LoveCoin
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a
            className="btn-base btn-ghosted"
            href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
          <button
            className="btn-base btn-ghosted"
            onClick={() => {
              navigator.clipboard?.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? "Link copied" : "Copy Link"}
          </button>
        </div>
      </div>

      <div className="mt-14 rounded-[2rem] bg-secondary/70 p-8">
        <p className="font-display text-2xl text-primary">Want to share the story behind it?</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button className="btn-base btn-primary" onClick={() => setComposer(true)}>
            Write a LoveNote
          </button>
          <button className="btn-base btn-ghosted" onClick={() => navigate({ to: "/explore" })}>
            Create Your Own LoveCoin
          </button>
        </div>
      </div>

      <LoveNoteComposer
        open={composer}
        loveType="gave"
        presetCoinId={coin.id}
        onClose={() => setComposer(false)}
      />
    </div>
  );
}
