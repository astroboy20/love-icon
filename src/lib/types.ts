/**
 * Core LoveCoin data model.
 *
 * The shapes below mirror the eventual database tables (users, lovecoins,
 * lovenotes, reactions, lovecoin_collections) so the MVP's local store can be
 * swapped for a real backend without touching UI code.
 */

export type CoinStyle = "classic" | "romantic" | "minimal" | "golden" | "personal";

export type CoinRelation = "Myself" | "Someone I love" | "Family" | "Friend" | "Someone special";

/** Reserved for future memory types (letters, songs, voice, video, time capsules). */
export type MemoryKind = "message" | "photo" | "letter" | "song" | "voice" | "video" | "capsule";

export interface User {
  id: string;
  display_name: string;
  created_at: string;
}

export interface Memory {
  id: string;
  kind: MemoryKind;
  content?: string;
  url?: string;
  unlock_at?: string | null;
}

export interface LoveCoin {
  id: string;
  coin_number: number;
  owner_id: string | null;
  creator_name: string;
  recipient_name: string;
  relation: CoinRelation;
  message: string;
  image_url?: string | null;
  style: CoinStyle;
  visibility: "public" | "private";
  status: "available" | "claimed";
  created_at: string;
  /** Future-ready: richer memories attach here (letters, songs, capsules). */
  memories?: Memory[];
  /** Future-ready: occasion coins (proposal, wedding, birthday, memorial). */
  occasion?: string | null;
  collection_id?: string | null;
}

export type LoveType = "gave" | "received";

export type NoteCategory =
  | "Romantic"
  | "Family"
  | "Friendship"
  | "Kindness"
  | "Mentorship"
  | "Community"
  | "Remembrance"
  | "Other";

export interface LoveNote {
  id: string;
  user_id: string | null;
  author_name: string;
  content: string;
  love_type: LoveType;
  category: NoteCategory;
  image_url?: string | null;
  love_coin_id?: string | null;
  created_at: string;
}

export type ReactionType = "loved" | "felt" | "smile" | "beautiful" | "grateful" | "inspired";

export interface Reaction {
  id: string;
  love_note_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

/** Future-ready: grouped coins (a family album, an anniversary series). */
export interface LoveCoinCollection {
  id: string;
  owner_id: string;
  title: string;
  coin_ids: string[];
  created_at: string;
}

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "loved", emoji: "❤️", label: "Loved" },
  { type: "felt", emoji: "🫂", label: "Felt This" },
  { type: "smile", emoji: "🥹", label: "Made Me Smile" },
  { type: "beautiful", emoji: "✨", label: "Beautiful" },
  { type: "grateful", emoji: "🙏", label: "Grateful" },
  { type: "inspired", emoji: "💕", label: "Inspired" },
];

export const COIN_STYLES: { id: CoinStyle; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "romantic", label: "Romantic" },
  { id: "minimal", label: "Minimal" },
  { id: "golden", label: "Golden" },
  { id: "personal", label: "Personal" },
];

export const NOTE_CATEGORIES: NoteCategory[] = [
  "Romantic",
  "Family",
  "Friendship",
  "Kindness",
  "Mentorship",
  "Community",
  "Remembrance",
  "Other",
];

export const TOTAL_COINS = 1_000_000_000;
export const COIN_PRICE_NGN = 100;
