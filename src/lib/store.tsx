import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { LoveCoin, LoveNote, ReactionType } from "./types";
import { CLAIMED_BASELINE } from "./heart";

/**
 * Everything the app keeps — LoveCoins, LoveNotes, reactions and profiles —
 * lives in the backend, so a person's memories follow them across devices.
 */

interface CurrentUser {
  id: string;
  display_name: string;
  email: string | null;
}

interface ReactionRow {
  love_note_id: string;
  user_id: string;
  reaction_type: ReactionType;
}

interface StoreValue {
  ready: boolean;
  currentUser: CurrentUser | null;
  coins: LoveCoin[];
  notes: LoveNote[];
  claimedCount: number;
  myReactions: Record<string, ReactionType[]>;
  coinByNumber: (n: number) => LoveCoin | undefined;
  coinById: (id: string) => LoveCoin | undefined;
  claimCoin: (
    input: Omit<LoveCoin, "id" | "owner_id" | "created_at" | "status">,
  ) => Promise<LoveCoin | null>;
  publishNote: (
    input: Omit<LoveNote, "id" | "user_id" | "author_name" | "created_at">,
  ) => Promise<LoveNote | null>;
  reactionCount: (noteId: string, type: ReactionType) => number;
  toggleReaction: (noteId: string, type: ReactionType) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

type CoinRow = {
  id: string;
  coin_number: number;
  owner_id: string | null;
  creator_name: string;
  recipient_name: string;
  relation: string;
  message: string;
  image_url: string | null;
  style: string;
  visibility: string;
  status: string;
  created_at: string;
};

type NoteRow = {
  id: string;
  user_id: string | null;
  author_name: string;
  content: string;
  love_type: string;
  category: string;
  image_url: string | null;
  love_coin_id: string | null;
  seed_reactions: Record<string, number> | null;
  created_at: string;
};

function toCoin(row: CoinRow): LoveCoin {
  return {
    id: row.id,
    coin_number: row.coin_number,
    owner_id: row.owner_id,
    creator_name: row.creator_name,
    recipient_name: row.recipient_name,
    relation: row.relation as LoveCoin["relation"],
    message: row.message,
    image_url: row.image_url,
    style: row.style as LoveCoin["style"],
    visibility: row.visibility as LoveCoin["visibility"],
    status: row.status as LoveCoin["status"],
    created_at: row.created_at,
  };
}

function toNote(row: NoteRow): LoveNote {
  return {
    id: row.id,
    user_id: row.user_id,
    author_name: row.author_name,
    content: row.content,
    love_type: row.love_type as LoveNote["love_type"],
    category: row.category as LoveNote["category"],
    image_url: row.image_url,
    love_coin_id: row.love_coin_id,
    created_at: row.created_at,
  };
}

export function LoveProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [coins, setCoins] = useState<LoveCoin[]>([]);
  const [notes, setNotes] = useState<LoveNote[]>([]);
  const [seeds, setSeeds] = useState<Record<string, Partial<Record<ReactionType, number>>>>({});
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const mounted = useRef(true);

  const userId = session?.user.id ?? null;

  const load = useCallback(async () => {
    const [coinRes, noteRes, reactionRes] = await Promise.all([
      supabase.from("lovecoins").select("*").order("created_at", { ascending: false }),
      supabase.from("lovenotes").select("*").order("created_at", { ascending: false }),
      supabase.from("reactions").select("love_note_id, user_id, reaction_type"),
    ]);
    if (!mounted.current) return;
    if (coinRes.data) setCoins((coinRes.data as CoinRow[]).map(toCoin));
    if (noteRes.data) {
      const rows = noteRes.data as NoteRow[];
      setNotes(rows.map(toNote));
      const seedMap: Record<string, Partial<Record<ReactionType, number>>> = {};
      rows.forEach((r) => {
        seedMap[r.id] = (r.seed_reactions ?? {}) as Partial<Record<ReactionType, number>>;
      });
      setSeeds(seedMap);
    }
    if (reactionRes.data) setReactions(reactionRes.data as ReactionRow[]);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted.current) setSession(data.session);
    });
    void load().finally(() => {
      if (mounted.current) setReady(true);
    });
    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  useEffect(() => {
    if (!userId) {
      setProfileName(null);
      return;
    }
    void supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted.current) setProfileName(data?.display_name ?? null);
      });
  }, [userId]);

  const currentUser: CurrentUser | null = useMemo(() => {
    if (!session?.user) return null;
    const meta = session.user.user_metadata as { display_name?: string; full_name?: string };
    return {
      id: session.user.id,
      display_name:
        profileName ??
        meta.display_name ??
        meta.full_name ??
        session.user.email?.split("@")[0] ??
        "Someone",
      email: session.user.email ?? null,
    };
  }, [session, profileName]);

  const value = useMemo<StoreValue>(() => {
    const myReactions: Record<string, ReactionType[]> = {};
    reactions.forEach((r) => {
      if (r.user_id !== userId) return;
      myReactions[r.love_note_id] = [...(myReactions[r.love_note_id] ?? []), r.reaction_type];
    });

    return {
      ready,
      currentUser,
      coins,
      notes,
      claimedCount: CLAIMED_BASELINE + coins.filter((c) => c.owner_id !== null).length,
      myReactions,
      coinByNumber: (n) => coins.find((c) => c.coin_number === n),
      coinById: (id) => coins.find((c) => c.id === id),
      claimCoin: async (input) => {
        if (!userId) return null;
        const { data, error } = await supabase
          .from("lovecoins")
          .insert({
            coin_number: input.coin_number,
            owner_id: userId,
            creator_name: input.creator_name,
            recipient_name: input.recipient_name,
            relation: input.relation,
            message: input.message,
            image_url: input.image_url ?? null,
            style: input.style,
            visibility: input.visibility,
            status: "claimed",
          })
          .select("*")
          .single();
        if (error || !data) return null;
        const coin = toCoin(data as CoinRow);
        setCoins((prev) => [coin, ...prev]);
        return coin;
      },
      publishNote: async (input) => {
        if (!userId || !currentUser) return null;
        const { data, error } = await supabase
          .from("lovenotes")
          .insert({
            user_id: userId,
            author_name: currentUser.display_name,
            content: input.content,
            love_type: input.love_type,
            category: input.category,
            image_url: input.image_url ?? null,
            love_coin_id: input.love_coin_id ?? null,
          })
          .select("*")
          .single();
        if (error || !data) return null;
        const note = toNote(data as NoteRow);
        setNotes((prev) => [note, ...prev]);
        return note;
      },
      reactionCount: (noteId, type) => {
        const base = seeds[noteId]?.[type] ?? 0;
        const live = reactions.filter(
          (r) => r.love_note_id === noteId && r.reaction_type === type,
        ).length;
        return base + live;
      },
      toggleReaction: async (noteId, type) => {
        if (!userId) return;
        const has = reactions.some(
          (r) => r.love_note_id === noteId && r.user_id === userId && r.reaction_type === type,
        );
        if (has) {
          setReactions((prev) =>
            prev.filter(
              (r) =>
                !(r.love_note_id === noteId && r.user_id === userId && r.reaction_type === type),
            ),
          );
          await supabase
            .from("reactions")
            .delete()
            .eq("love_note_id", noteId)
            .eq("user_id", userId)
            .eq("reaction_type", type);
        } else {
          setReactions((prev) => [
            ...prev,
            { love_note_id: noteId, user_id: userId, reaction_type: type },
          ]);
          await supabase
            .from("reactions")
            .insert({ love_note_id: noteId, user_id: userId, reaction_type: type });
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
      },
      refresh: load,
    };
  }, [ready, currentUser, coins, notes, reactions, seeds, userId, load]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useLove() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useLove must be used inside LoveProvider");
  return ctx;
}
