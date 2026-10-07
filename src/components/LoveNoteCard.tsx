import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLove } from "@/lib/store";
import { REACTIONS, type LoveNote } from "@/lib/types";
import { timeLabel } from "@/lib/format";

export function LoveNoteCard({ note }: { note: LoveNote }) {
  const { reactionCount, toggleReaction, myReactions, coinById, currentUser } = useLove();
  const navigate = useNavigate();
  const [popped, setPopped] = useState<string | null>(null);
  const mine = myReactions[note.id] ?? [];
  const coin = note.love_coin_id ? coinById(note.love_coin_id) : undefined;

  const visible = REACTIONS.filter((r) => reactionCount(note.id, r.type) > 0 || mine.includes(r.type));
  const rest = REACTIONS.filter((r) => !visible.includes(r));

  return (
    <article className="rounded-[1.75rem] border border-border/70 bg-card/80 p-6 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)] sm:p-8">
      <header className="flex flex-wrap items-center gap-3">
        <span className="font-display text-lg tracking-wide text-primary uppercase">
          {note.author_name}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-[0.62rem] font-semibold tracking-[0.18em] uppercase ${
            note.love_type === "gave"
              ? "bg-primary/10 text-primary"
              : "bg-[oklch(0.83_0.062_18_/_0.28)] text-primary"
          }`}
        >
          {note.love_type === "gave" ? "I gave love" : "I received love"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{timeLabel(note.created_at)}</span>
      </header>

      <p className="font-display mt-4 text-2xl leading-snug text-foreground sm:text-[1.6rem]">
        “{note.content}”
      </p>

      {note.image_url ? (
        <img
          src={note.image_url}
          alt="Shared moment"
          className="mt-5 max-h-80 w-full rounded-2xl object-cover"
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="tracking-[0.18em] uppercase">{note.category}</span>
        {coin ? (
          <Link
            to="/coin/$coinNumber"
            params={{ coinNumber: String(coin.coin_number) }}
            className="text-primary underline-offset-4 hover:underline"
          >
            Kept as LoveCoin #{String(coin.coin_number).padStart(8, "0")}
          </Link>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-5">
        {[...visible, ...rest].map((r) => {
          const active = mine.includes(r.type);
          const count = reactionCount(note.id, r.type);
          return (
            <button
              key={r.type}
              type="button"
              aria-label={r.label}
              onClick={() => {
                if (!currentUser) {
                  void navigate({ to: "/auth" });
                  return;
                }
                void toggleReaction(note.id, r.type);
                setPopped(r.type);
                setTimeout(() => setPopped(null), 450);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all ${
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:border-primary/30"
              }`}
            >
              <span className={popped === r.type ? "animate-react-pop" : ""}>{r.emoji}</span>
              {count > 0 ? <span className="text-xs font-semibold">{count}</span> : null}
            </button>
          );
        })}
      </div>
    </article>
  );
}
