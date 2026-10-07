import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "How LoveCoin works — Keep love, share love";
const DESC =
  "Discover love, claim a LoveCoin, personalise it, keep it, share it, write a LoveNote, and watch love spread.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  { title: "Discover love", body: "Open the Billion-Coin Heart and find a space that feels like yours." },
  { title: "Claim a LoveCoin", body: "₦100 secures one tiny, permanent place on the internet." },
  { title: "Personalise it", body: "A name, a message, a photo, a style. Small things, kept carefully." },
  { title: "Keep it", body: "Your LoveCoin lives on its own page — a digital keepsake, not a feed post." },
  { title: "Share it", body: "Send it by WhatsApp or link. It opens like a gift." },
  { title: "Write a LoveNote", body: "Tell the story behind it in the Love of Fame." },
  { title: "People react", body: "No comments. No followers. Just quiet, warm reactions." },
  { title: "Spread love", body: "Every note someone reads makes the heart a little brighter." },
];

function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
      <p className="text-[0.7rem] tracking-[0.35em] text-muted-foreground uppercase">How it works</p>
      <h1 className="font-display text-balance-tight mt-4 text-5xl text-primary md:text-6xl">
        Keep love. Share love. Celebrate love.
      </h1>
      <p className="mt-5 max-w-xl text-muted-foreground">
        LoveCoin is a place for the moments that don't fit anywhere else. A LoveCoin is something
        you keep. A LoveNote is something you share.
      </p>

      <ol className="mt-14 space-y-0">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-6 border-t border-border/70 py-7">
            <span className="font-display w-10 shrink-0 text-2xl text-[var(--color-gold)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="font-display text-2xl text-primary">{step.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link to="/explore" className="btn-base btn-primary">
          Claim a LoveCoin ❤️
        </Link>
        <Link to="/love-of-fame" className="btn-base btn-ghosted">
          Explore Love of Fame
        </Link>
      </div>
    </div>
  );
}
