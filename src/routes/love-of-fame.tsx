import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LoveNoteCard } from "@/components/LoveNoteCard";
import { LoveNoteComposer } from "@/components/LoveNoteComposer";
import { useLove } from "@/lib/store";
import { dayGroupLabel } from "@/lib/format";
import type { LoveNote, LoveType } from "@/lib/types";

const TITLE = "Love of Fame — Where love is shared";
const DESC =
  "How did you give or receive love today? Read and share LoveNotes — short, true stories of love. No comments, only reactions.";

export const Route = createFileRoute("/love-of-fame")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: LoveOfFame,
});

function LoveOfFame() {
  const { notes } = useLove();
  const [composer, setComposer] = useState<LoveType | null>(null);

  const groups = useMemo(() => {
    const sorted = [...notes].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const map = new Map<string, LoveNote[]>();
    sorted.forEach((n) => {
      const key = dayGroupLabel(n.created_at);
      map.set(key, [...(map.get(key) ?? []), n]);
    });
    return [...map.entries()];
  }, [notes]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-14 md:px-8 md:py-20">
      <header className="text-center">
        <p className="text-[0.7rem] tracking-[0.35em] text-muted-foreground uppercase">
          Love of Fame
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Where love is shared.</p>
        <h1 className="font-display text-balance-tight mt-6 text-[2.75rem] leading-[1] text-primary md:text-6xl">
          How did you give or receive love today?
        </h1>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="btn-base btn-primary" onClick={() => setComposer("gave")}>
            ❤️ I gave love
          </button>
          <button className="btn-base btn-ghosted" onClick={() => setComposer("received")}>
            💕 I received love
          </button>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="mt-20 rounded-[2rem] border border-border/70 bg-card/70 p-12 text-center">
          <h2 className="font-display text-4xl text-primary">Someone has to start the love.</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            How did you give or receive love today?
          </p>
          <button className="btn-base btn-primary mt-7" onClick={() => setComposer("gave")}>
            Share a LoveNote
          </button>
        </div>
      ) : (
        <div className="mt-16 space-y-14">
          {groups.map(([label, items]) => (
            <section key={label}>
              <div className="mb-6 flex items-center gap-4">
                <h2 className="text-[0.68rem] font-semibold tracking-[0.3em] text-muted-foreground uppercase">
                  {label}
                </h2>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-6">
                {items.map((note) => (
                  <LoveNoteCard key={note.id} note={note} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <LoveNoteComposer
        open={composer !== null}
        loveType={composer ?? "gave"}
        onClose={() => setComposer(null)}
      />
    </div>
  );
}
