import type { CoinStyle } from "@/lib/types";

const STYLE_BG: Record<CoinStyle, string> = {
  classic:
    "linear-gradient(145deg, oklch(0.46 0.13 20), oklch(0.27 0.095 15)) padding-box, linear-gradient(145deg, oklch(0.86 0.07 70), oklch(0.6 0.08 30)) border-box",
  romantic:
    "linear-gradient(145deg, oklch(0.88 0.075 18), oklch(0.62 0.13 15)) padding-box, linear-gradient(145deg, oklch(0.96 0.03 30), oklch(0.75 0.08 20)) border-box",
  minimal:
    "linear-gradient(145deg, oklch(0.985 0.006 80), oklch(0.91 0.012 70)) padding-box, linear-gradient(145deg, oklch(0.95 0.01 80), oklch(0.82 0.015 60)) border-box",
  golden:
    "linear-gradient(145deg, oklch(0.9 0.09 88), oklch(0.68 0.11 70)) padding-box, linear-gradient(145deg, oklch(0.97 0.05 90), oklch(0.72 0.1 65)) border-box",
  personal:
    "linear-gradient(145deg, oklch(0.36 0.04 300), oklch(0.24 0.03 20)) padding-box, linear-gradient(145deg, oklch(0.8 0.06 40), oklch(0.5 0.05 20)) border-box",
};

const STYLE_TEXT: Record<CoinStyle, string> = {
  classic: "oklch(0.97 0.02 80)",
  romantic: "oklch(0.28 0.09 15)",
  minimal: "oklch(0.3 0.05 20)",
  golden: "oklch(0.3 0.07 60)",
  personal: "oklch(0.96 0.02 70)",
};

interface Props {
  style: CoinStyle;
  coinNumber?: number;
  creator?: string;
  recipient?: string;
  imageUrl?: string | null | undefined;
  size?: number;
  className?: string;
  animate?: boolean;
}

export function CoinVisual({
  style,
  coinNumber,
  creator,
  recipient,
  imageUrl,
  size = 200,
  className = "",
  animate = false,
}: Props) {
  return (
    <div
      className={`relative shrink-0 rounded-full ${animate ? "animate-coin-reveal" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: STYLE_BG[style],
        border: "3px solid transparent",
        boxShadow:
          "inset 0 2px 14px oklch(1 0 0 / 0.28), inset 0 -8px 20px oklch(0 0 0 / 0.14), 0 22px 60px oklch(0.32 0.11 18 / 0.22)",
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={recipient ? `Photo on the LoveCoin for ${recipient}` : "LoveCoin photo"}
          className="absolute inset-[7%] rounded-full object-cover"
          style={{ width: "86%", height: "86%", opacity: 0.92 }}
        />
      ) : null}

      <div
        className="absolute inset-[7%] flex flex-col items-center justify-center rounded-full px-[10%] text-center"
        style={{
          color: STYLE_TEXT[style],
          background: imageUrl ? "oklch(0.2 0.02 20 / 0.42)" : "transparent",
          backdropFilter: imageUrl ? "blur(1px)" : undefined,
          border: "1px solid oklch(1 0 0 / 0.22)",
        }}
      >
        <span
          className="font-display leading-none"
          style={{ fontSize: size * 0.14, opacity: 0.95 }}
        >
          {creator || "—"}
        </span>
        <span
          className="my-[2%] tracking-[0.35em] uppercase"
          style={{ fontSize: Math.max(7, size * 0.05), opacity: 0.7 }}
        >
          for
        </span>
        <span className="font-display leading-none" style={{ fontSize: size * 0.155 }}>
          {recipient || "—"}
        </span>
        {coinNumber ? (
          <span
            className="mt-[6%] tracking-[0.22em] uppercase"
            style={{ fontSize: Math.max(7, size * 0.045), opacity: 0.65 }}
          >
            #{String(coinNumber).padStart(8, "0")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
