import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Modal } from "./Modal";
import { useLove } from "@/lib/store";
import { NOTE_CATEGORIES, type LoveType, type NoteCategory } from "@/lib/types";

export function LoveNoteComposer({
  open,
  loveType,
  onClose,
  presetCoinId,
}: {
  open: boolean;
  loveType: LoveType;
  onClose: () => void;
  presetCoinId?: string | null;
}) {
  const { publishNote, coins, currentUser } = useLove();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<NoteCategory>("Kindness");
  const [image, setImage] = useState<string | null>(null);
  const [coinId, setCoinId] = useState<string>(presetCoinId ?? "");
  const [published, setPublished] = useState(false);

  const myCoins = currentUser ? coins.filter((c) => c.owner_id === currentUser.id) : [];

  const close = () => {
    setContent("");
    setImage(null);
    setCoinId(presetCoinId ?? "");
    setPublished(false);
    onClose();
  };

  const onPhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const note = await publishNote({
      content: content.trim(),
      love_type: loveType,
      category,
      image_url: image,
      love_coin_id: coinId || null,
    });
    setSaving(false);
    if (note) setPublished(true);
  };

  if (open && !currentUser) {
    return (
      <Modal open={open} onClose={close} labelledBy="signin-note-title">
        <div className="py-4 text-center">
          <h2 id="signin-note-title" className="font-display text-3xl text-primary">
            Sign in to share your moment.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            Your LoveNotes are saved to your account, so they stay with you everywhere.
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

  if (published) {
    return (
      <Modal open={open} onClose={close} labelledBy="published-title">
        <div className="py-4 text-center">
          <div className="font-display text-5xl">💌</div>
          <h2 id="published-title" className="font-display mt-4 text-3xl text-primary">
            Your LoveNote is now part of the Love of Fame.
          </h2>
          <div className="mt-8 rounded-2xl bg-secondary/70 p-6">
            <p className="font-display text-2xl text-primary">
              Want to keep this moment forever?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn this LoveNote into a LoveCoin.
            </p>
            <button
              className="btn-base btn-primary mt-5"
              onClick={() => {
                close();
                navigate({ to: "/explore" });
              }}
            >
              Create LoveCoin
            </button>
          </div>
          <button className="btn-base btn-ghosted mt-4" onClick={close}>
            Back to the timeline
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} labelledBy="composer-title">
      <p className="text-[0.7rem] tracking-[0.3em] text-muted-foreground uppercase">
        {loveType === "gave" ? "❤️ I gave love" : "💕 I received love"}
      </p>
      <h2 id="composer-title" className="font-display mt-2 text-4xl text-primary">
        Tell us about the moment.
      </h2>

      <textarea
        rows={5}
        className="field mt-6 resize-none text-base"
        placeholder="Tell us about the moment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <div className="mt-5">
        <span className="mb-2 block text-sm font-semibold">Category</span>
        <div className="flex flex-wrap gap-2">
          {NOTE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${
                category === c
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
        {image ? "Photo added — tap to change" : "Add a photo (optional)"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
      </label>

      {myCoins.length > 0 ? (
        <div className="mt-5">
          <label className="mb-2 block text-sm font-semibold" htmlFor="coin-link">
            Connect this LoveNote to a LoveCoin (optional)
          </label>
          <select
            id="coin-link"
            className="field"
            value={coinId}
            onChange={(e) => setCoinId(e.target.value)}
          >
            <option value="">No LoveCoin</option>
            {myCoins.map((c) => (
              <option key={c.id} value={c.id}>
                #{String(c.coin_number).padStart(8, "0")} — {c.creator_name} for{" "}
                {c.recipient_name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <button
        type="button"
        disabled={!content.trim()}
        onClick={submit}
        className="btn-base btn-primary mt-7 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        Share LoveNote
      </button>
    </Modal>
  );
}
