/**
 * Real-time subscription manager hook.
 *
 * Sets up and tears down Supabase Realtime channel subscriptions, dispatching
 * RTK Query cache updates for live UI refresh. Three channels are managed:
 *
 *   - lovecoins-inserts  — INSERT events on `lovecoins` (always active when authed)
 *   - lovenotes-inserts  — INSERT events on `lovenotes` (always active when authed)
 *   - reactions-changes  — INSERT + DELETE events on `reactions`
 *                          (only when `subscribeToReactions` is true)
 *
 * Design principles:
 *   - RLS is enforced by Supabase Realtime: private coins are never delivered to
 *     non-owners (Requirement 21.17), so the client does not need to filter them.
 *   - Deduplication guards prevent adding the same record twice when a real-time
 *     event races with an in-flight RTK Query refetch (Requirements 7.5, 8.5).
 *   - All channels are removed on unmount or sign-out to prevent memory leaks
 *     (Requirements 7.4, 8.4, 9.4).
 *   - Reconnection uses exponential backoff (1 s → 2 s → 4 s), capped at 3
 *     attempts, then falls back to `setRealtimeUnavailable()` (Requirements 18.3, 18.4).
 *
 * Usage:
 *   ```tsx
 *   // Root layout — always active:
 *   useRealtimeSync({ subscribeToReactions: false });
 *
 *   // Love of Fame page — also subscribes to reactions:
 *   useRealtimeSync({ subscribeToReactions: true });
 *   ```
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5,
 *               9.1, 9.2, 9.3, 9.4, 9.5, 18.3, 18.4, 21.17, 22.9
 */
import { useEffect, useRef, type MutableRefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { useAppDispatch, useAppSelector } from "@/app/store";
import { selectCurrentUser } from "@/features/auth/slices/authSlice";
import { setRealtimeUnavailable } from "@/features/auth/slices/authSlice";
import { coinsApi } from "@/features/coins/api/coinsApi";
import { fameApi } from "@/features/fame/api/fameApi";
import { supabase } from "@/integrations/supabase/client";
import type { CoinSummary } from "@/features/coins/api/coinsApi";
import type { LoveNote, ReactionRow } from "@/features/fame/api/fameApi";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RECONNECT_ATTEMPTS = 3;

// Channel names — kept as constants so cleanup is unambiguous.
const CHANNEL_COINS = "lovecoins-inserts";
const CHANNEL_NOTES = "lovenotes-inserts";
const CHANNEL_REACTIONS = "reactions-changes";

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------

export interface UseRealtimeSyncOptions {
  /**
   * When true, the reactions channel is also subscribed. Set this only on
   * pages that display LoveNotes and their reaction counts (Requirement 9.5).
   */
  subscribeToReactions?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Subscribe a channel with exponential-backoff reconnection.
 *
 * Calls `channel.subscribe()`, then watches the subscription status. If the
 * channel errors or times out it schedules a re-subscribe with 1s/2s/4s
 * delays up to `MAX_RECONNECT_ATTEMPTS`. After that, dispatches
 * `setRealtimeUnavailable()` and gives up (Requirements 18.3, 18.4).
 *
 * @param channel       The already-configured RealtimeChannel instance.
 * @param onUnavailable Callback invoked after all reconnection attempts fail.
 * @param attemptsRef   Mutable ref tracking the current attempt count.
 */
function subscribeWithBackoff(
  channel: RealtimeChannel,
  onUnavailable: () => void,
  attemptsRef: MutableRefObject<number>,
): void {
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      // Reset counter on successful connection.
      attemptsRef.current = 0;
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        attemptsRef.current += 1;
        // Backoff: 1 s, 2 s, 4 s.
        const delayMs = 1000 * Math.pow(2, attemptsRef.current - 1);
        setTimeout(() => {
          channel.subscribe();
        }, delayMs);
      } else {
        onUnavailable();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRealtimeSync({
  subscribeToReactions = false,
}: UseRealtimeSyncOptions = {}): void {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectCurrentUser);

  // Per-channel reconnection attempt counters — persisted across re-renders
  // but reset when channels are torn down and re-created on user change.
  const coinsAttempts = useRef(0);
  const notesAttempts = useRef(0);
  const reactionsAttempts = useRef(0);

  // ---------------------------------------------------------------------------
  // Coins + Notes channels (active whenever user is authenticated)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Do not subscribe when unauthenticated (Requirement 7.1).
    if (!currentUser) return;

    // Reset attempt counters for this session.
    coinsAttempts.current = 0;
    notesAttempts.current = 0;

    // ------------------------------------------------------------------
    // lovecoins channel — INSERT events (Requirement 7.1, 7.2)
    // ------------------------------------------------------------------
    // Supabase Realtime respects RLS: private coins are never delivered to
    // non-owners, so no client-side visibility filter is needed (Req 21.17).
    const coinsChannel = supabase
      .channel(CHANNEL_COINS)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lovecoins" },
        (payload) => {
          const newCoin = payload.new as CoinSummary & { id?: string };

          // Update the 'getCoins' cache with deduplication (Requirement 7.5).
          dispatch(
            coinsApi.util.updateQueryData(
              "getCoins",
              undefined,
              (draft: CoinSummary[]) => {
                if (!draft.some((c) => c.coin_number === newCoin.coin_number)) {
                  draft.unshift(newCoin);
                }
              },
            ),
          );
        },
      );

    // ------------------------------------------------------------------
    // lovenotes channel — INSERT events (Requirement 8.1, 8.2)
    // ------------------------------------------------------------------
    const notesChannel = supabase
      .channel(CHANNEL_NOTES)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lovenotes" },
        (payload) => {
          const newNote = payload.new as LoveNote;

          // Update the 'getNotes' cache with deduplication (Requirement 8.5).
          dispatch(
            fameApi.util.updateQueryData(
              "getNotes",
              undefined,
              (draft: LoveNote[]) => {
                if (!draft.some((n) => n.id === newNote.id)) {
                  // Prepend so the latest note appears first (matches ordering).
                  draft.unshift(newNote);
                }
              },
            ),
          );
        },
      );

    // Subscribe both channels with backoff reconnection.
    subscribeWithBackoff(coinsChannel, () => dispatch(setRealtimeUnavailable()), coinsAttempts);
    subscribeWithBackoff(notesChannel, () => dispatch(setRealtimeUnavailable()), notesAttempts);

    // Cleanup: remove channels on unmount or sign-out (Requirements 7.4, 8.4).
    return () => {
      supabase.removeChannel(coinsChannel);
      supabase.removeChannel(notesChannel);
    };
  }, [dispatch, currentUser]);

  // ---------------------------------------------------------------------------
  // Reactions channel (only when on a page displaying LoveNotes — Req 9.5)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!currentUser || !subscribeToReactions) return;

    reactionsAttempts.current = 0;

    const reactionsChannel = supabase
      .channel(CHANNEL_REACTIONS)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reactions" },
        (payload) => {
          const newReaction = payload.new as ReactionRow;

          // Add the reaction to the getReactions cache with deduplication.
          // Deduplication key: (love_note_id, user_id, reaction_type) (Req 9.2).
          dispatch(
            fameApi.util.updateQueryData(
              "getReactions",
              undefined,
              (draft: ReactionRow[]) => {
                const exists = draft.some(
                  (r) =>
                    r.love_note_id === newReaction.love_note_id &&
                    r.user_id === newReaction.user_id &&
                    r.reaction_type === newReaction.reaction_type,
                );
                if (!exists) {
                  draft.push(newReaction);
                }
              },
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "reactions" },
        (payload) => {
          const deleted = payload.old as Partial<ReactionRow>;

          // Remove the reaction from the cache (Requirement 9.3).
          dispatch(
            fameApi.util.updateQueryData(
              "getReactions",
              undefined,
              (draft: ReactionRow[]) => {
                const idx = draft.findIndex(
                  (r) =>
                    r.love_note_id === deleted.love_note_id &&
                    r.user_id === deleted.user_id &&
                    r.reaction_type === deleted.reaction_type,
                );
                if (idx !== -1) {
                  draft.splice(idx, 1);
                }
              },
            ),
          );
        },
      );

    subscribeWithBackoff(
      reactionsChannel,
      () => dispatch(setRealtimeUnavailable()),
      reactionsAttempts,
    );

    // Cleanup: remove reactions channel on unmount or sign-out (Requirement 9.4).
    return () => {
      supabase.removeChannel(reactionsChannel);
    };
  }, [dispatch, currentUser, subscribeToReactions]);
}
