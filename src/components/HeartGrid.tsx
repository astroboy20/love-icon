import { useEffect, useMemo, useRef, useState } from "react";
import { buildHeart } from "@/lib/heart";
import type { CoinStyle } from "@/lib/types";
import { useLove } from "@/lib/store";

const CLAIMED_FILL: Record<CoinStyle, string> = {
  classic: "linear-gradient(140deg, oklch(0.5 0.13 20), oklch(0.3 0.1 15))",
  romantic: "linear-gradient(140deg, oklch(0.84 0.09 18), oklch(0.62 0.13 15))",
  minimal: "linear-gradient(140deg, oklch(0.97 0.01 80), oklch(0.86 0.015 60))",
  golden: "linear-gradient(140deg, oklch(0.9 0.09 88), oklch(0.7 0.11 72))",
  personal: "linear-gradient(140deg, oklch(0.4 0.05 300), oklch(0.26 0.03 20))",
};

interface Props {
  onSelect: (coinNumber: number) => void;
  compact?: boolean;
}

export function HeartGrid({ onSelect, compact = false }: Props) {
  const { coins } = useLove();
  const cells = useMemo(() => buildHeart(compact ? 38 : 48), [compact]);
  const claimedMap = useMemo(() => {
    const m = new Map<number, CoinStyle>();
    coins.forEach((c) => m.set(c.coin_number, c.style));
    return m;
  }, [coins]);

  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reveal = () => setRevealed(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.02, rootMargin: "120px" },
    );
    io.observe(el);
    // safety net: never leave the heart invisible
    const t = setTimeout(reveal, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative mx-auto aspect-square w-full max-w-[min(90vw,680px)]"
      role="group"
      aria-label="The Billion-Coin Heart"
    >
      <div
        className="pointer-events-none absolute inset-[-12%] rounded-full opacity-70 blur-3xl transition-opacity duration-1000"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, oklch(0.83 0.09 20 / 0.55), transparent 62%)",
          opacity: revealed ? 0.8 : 0,
        }}
      />
      {cells.map((cell) => {
        const style = claimedMap.get(cell.coin_number);
        const claimed = Boolean(style);
        const delay = revealed ? cell.seed * 700 + cell.y * 6 : 0;
        return (
          <button
            key={cell.index}
            type="button"
            onClick={() => onSelect(cell.coin_number)}
            title={
              claimed
                ? `LoveCoin #${String(cell.coin_number).padStart(8, "0")} — claimed`
                : `LoveCoin #${String(cell.coin_number).padStart(8, "0")} — available`
            }
            aria-label={`LoveCoin number ${cell.coin_number}, ${claimed ? "claimed" : "available"}`}
            className="absolute rounded-full transition-[transform,box-shadow,opacity] duration-300 ease-out will-change-transform hover:z-10 hover:scale-[1.9] focus-visible:z-10 focus-visible:scale-[1.9] focus-visible:outline-none"
            style={{
              left: `${cell.x}%`,
              top: `${cell.y}%`,
              width: `${cell.size}%`,
              height: `${cell.size}%`,
              transform: "translate(-50%, -50%)",
              transformOrigin: "center",
              background: claimed
                ? CLAIMED_FILL[style as CoinStyle]
                : `oklch(${0.845 - cell.seed * 0.06} ${0.03 + cell.seed * 0.02} ${18 + cell.seed * 40})`,
              boxShadow: claimed
                ? "0 0 12px oklch(0.55 0.15 18 / 0.5)"
                : "inset 0 1px 1px oklch(1 0 0 / 0.5)",
              opacity: revealed ? (claimed ? 1 : 0.72 + cell.seed * 0.28) : 0,
              transitionDelay: `${delay}ms`,
              animation: claimed
                ? `coin-pulse ${5 + cell.seed * 4}s ease-in-out ${cell.seed * 3}s infinite`
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
