import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Modal } from "./Modal";
import { CoinVisual } from "./CoinVisual";
import { useLove } from "@/lib/store";
import { chargeCard } from "@/lib/payments";
import { coinLabel } from "@/lib/format";
import { COIN_PRICE_NGN, COIN_STYLES, type CoinRelation, type CoinStyle } from "@/lib/types";

const RELATIONS: CoinRelation[] = [
  "Myself",
  "Someone I love",
  "Family",
  "Friend",
  "Someone special",
];

export function ClaimFlow({
  coinNumber,
  open,
  onClose,
}: {
  coinNumber: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const { claimCoin, coinByNumber, currentUser } = useLove();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  const [relation, setRelation] = useState<CoinRelation>("Someone I love");
  const [creator, setCreator] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState<CoinStyle>("classic");
  const [paying, setPaying] = useState(false);

  const existing = coinNumber ? coinByNumber(coinNumber) : undefined;

  const reset = () => {
    setRelation("Someone I love");
    setCreator("");
    setRecipient("");
    setMessage("");
    setImage(null);
    setStyle("classic");
    setPaying(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onPhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!coinNumber || !creator.trim() || !recipient.trim()) return;
    setFailed(false);
    setPaying(true);
    const res = await chargeCard({
      amountNgn: COIN_PRICE_NGN,
      reference: `lovecoin-${coinNumber}-${Date.now()}`,
      description: coinLabel(coinNumber),
    });
    if (res.status !== "success") {
      setPaying(false);
      return;
    }
    const coin = await claimCoin({
      coin_number: coinNumber,
      creator_name: creator.trim(),
      recipient_name: recipient.trim(),
      relation,
      message: message.trim(),
      image_url: image,
      style,
      visibility: "public",
    });
    if (!coin) {
      setPaying(false);
      setFailed(true);
      return;
    }
    reset();
    onClose();
    navigate({ to: "/coin/$coinNumber", params: { coinNumber: String(coinNumber) } });
  };

  if (!coinNumber) return null;

  if (!currentUser) {
    return (
      <Modal open={open} onClose={close} labelledBy="signin-title">
        <div className="py-4 text-center">
          <h2 id="signin-title" className="font-display text-3xl text-primary">
            Sign in to keep this one.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            Your LoveCoins are saved to your account, so they're waiting for you on any device.
          </p>
          <button
            className="btn-base btn-primary mt-7"
            onClick={() => {
              close();
              navigate({ to: "/auth" });
            }}
          >
            Sign in or create an account
          </button>
        </div>
      </Modal>
    );
  }

  if (existing) {
    return (
      <Modal open={open} onClose={close} labelledBy="claimed-title">
        <div className="flex flex-col items-center text-center">
          <CoinVisual
            style={existing.style}
            coinNumber={existing.coin_number}
            creator={existing.creator_name}
            recipient={existing.recipient_name}
            imageUrl={existing.image_url}
            size={168}
            animate
          />
          <h2 id="claimed-title" className="font-display mt-6 text-3xl text-primary">
            This one is taken.
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {coinLabel(existing.coin_number)} already belongs to a moment between{" "}
            {existing.creator_name} and {existing.recipient_name}.
          </p>
          <button
            className="btn-base btn-primary mt-6"
            onClick={() => {
              close();
              navigate({
                to: "/coin/$coinNumber",
                params: { coinNumber: String(existing.coin_number) },
              });
            }}
          >
            Open this LoveCoin
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} labelledBy="claim-title">
      <div className="text-center">
        <p className="text-[0.7rem] tracking-[0.3em] text-muted-foreground uppercase">
          {coinLabel(coinNumber)}
        </p>
        <h2 id="claim-title" className="font-display mt-2 text-4xl text-primary">
          Claim your little piece of love.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          ₦{COIN_PRICE_NGN} · yours to keep, forever.
        </p>
      </div>

      <div className="mt-7 flex justify-center">
        <CoinVisual
          style={style}
          coinNumber={coinNumber}
          creator={creator || "Your name"}
          recipient={recipient || "Their name"}
          imageUrl={image}
          size={168}
        />
      </div>

      <div className="mt-8 space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-semibold">Who is this LoveCoin for?</h3>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRelation(r)}
                className={`rounded-full border px-4 py-2 text-sm transition-all ${
                  relation === r
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="creator">
              Your name
            </label>
            <input
              id="creator"
              className="field"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder="Simi"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="recipient">
              Their name
            </label>
            <input
              id="recipient"
              className="field"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Abbie"
            />
          </div>
        </section>

        <section>
          <label className="mb-2 block text-sm font-semibold" htmlFor="message">
            Write something meaningful
          </label>
          <textarea
            id="message"
            rows={3}
            className="field resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ordinary days with you never feel ordinary…"
          />
        </section>

        <section>
          <span className="mb-2 block text-sm font-semibold">Add a photo (optional)</span>
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
            {image ? "Photo added — tap to change" : "Choose a photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPhoto(e.target.files?.[0])}
            />
          </label>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold">Choose a style</h3>
          <div className="flex flex-wrap gap-2">
            {COIN_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={`rounded-full border px-4 py-2 text-sm transition-all ${
                  style === s.id
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <button
        type="button"
        disabled={paying || !creator.trim() || !recipient.trim()}
        onClick={submit}
        className="btn-base btn-primary mt-8 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {paying ? "Securing your LoveCoin…" : `Secure My LoveCoin — ₦${COIN_PRICE_NGN}`}
      </button>
      {failed ? (
        <p className="mt-3 text-center text-xs text-primary">
          Someone just claimed this one. Pick another spot on the heart.
        </p>
      ) : null}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Demo checkout — no real payment is taken yet.
      </p>
    </Modal>
  );
}
