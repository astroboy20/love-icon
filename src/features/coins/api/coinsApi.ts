/**
 * RTK Query API slice for LoveCoins.
 *
 * Wraps Supabase queries against the `lovecoins` table and Storage uploads
 * for coin photos. Provides hooks for fetching coins, uploading images, and
 * querying "received coins" (coins where the recipient is the current user
 * but the owner is someone else).
 *
 * Tag types:
 *   "Coins"        — all coins (e.g., for HeartGrid rendering)
 *   "Coin"         — individual coin by coin_number
 *   "MyCoins"      — coins created by the current user
 *   "ReceivedCoins" — coins received by the current user
 *
 * Requirements: 2.1, 2.2, 2.5, 15.2, 15.3, 17.1, 17.5, 22.4
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseBaseQuery, interceptSupabaseError } from "@/lib/api/supabaseBaseQuery";
import { STORAGE_BUCKETS } from "@/lib/config/app";
import type { Tables } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type LoveCoin = Tables<"lovecoins">;

/** Minimal coin data used for HeartGrid rendering. */
export interface CoinSummary {
  coin_number: number;
  style: string;
  owner_id: string | null;
}

// ---------------------------------------------------------------------------
// Helper: generate unique storage path
// Format: {userId}/{timestamp}-{randomId}.{ext}
// Requirements: 2.5, 19.1, 19.2
// ---------------------------------------------------------------------------

function generateStoragePath(userId: string, filename: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 9);
  const ext = filename.split(".").pop() || "jpg";
  return `${userId}/${timestamp}-${randomId}.${ext}`;
}

// ---------------------------------------------------------------------------
// coinsApi
// ---------------------------------------------------------------------------

export const coinsApi = createApi({
  reducerPath: "coinsApi",
  baseQuery: supabaseBaseQuery,
  tagTypes: ["Coins", "Coin", "MyCoins", "ReceivedCoins"],
  endpoints: (build) => ({
    // ------------------------------------------------------------------
    // getCoins — fetch all coins for HeartGrid rendering.
    // Selects only coin_number, style, owner_id for performance.
    // ------------------------------------------------------------------
    getCoins: build.query<CoinSummary[], { limit?: number; offset?: number } | void>({
      queryFn: async (args, { dispatch }) => {
        const { limit, offset } = args || {};
        let query = supabase
          .from("lovecoins")
          .select("coin_number, style, owner_id")
          .order("coin_number", { ascending: true });

        if (limit !== undefined) query = query.limit(limit);
        if (offset !== undefined) query = query.range(offset, offset + (limit || 100) - 1);

        const { data, error } = await query;
        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: data as CoinSummary[] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ coin_number }) => ({ type: "Coin" as const, id: coin_number })),
              { type: "Coins" as const },
            ]
          : [{ type: "Coins" as const }],
    }),

    // ------------------------------------------------------------------
    // getCoinByNumber — fetch a single coin by its coin_number.
    // ------------------------------------------------------------------
    getCoinByNumber: build.query<LoveCoin | null, number>({
      queryFn: async (coinNumber, { dispatch }) => {
        const { data, error } = await supabase
          .from("lovecoins")
          .select("*")
          .eq("coin_number", coinNumber)
          .maybeSingle();
        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data };
      },
      providesTags: (_result, _error, coinNumber) => [{ type: "Coin", id: coinNumber }],
    }),

    // ------------------------------------------------------------------
    // getMyCoins — fetch all coins created by the current user.
    // ------------------------------------------------------------------
    getMyCoins: build.query<LoveCoin[], void>({
      queryFn: async (_arg, { dispatch }) => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: [] };

        const { data, error } = await supabase
          .from("lovecoins")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: data || [] };
      },
      providesTags: ["MyCoins"],
    }),

    // ------------------------------------------------------------------
    // getReceivedCoins — fetch coins received by the current user.
    // These are coins where:
    //   - owner_id is NOT the current user
    //   - recipient_name matches the current user's display name or email
    //     (in the current schema, recipient_name is free text; in a future
    //     design, a recipient_user_id FK would be more robust)
    //
    // Requirement 15.2: "query LoveCoins where owner_id != current user
    //                    and recipient matches current user"
    // ------------------------------------------------------------------
    getReceivedCoins: build.query<LoveCoin[], void>({
      queryFn: async (_arg, { dispatch }) => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: [] };

        // Fetch the user's profile to get display_name
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .single();

        const recipientName = profile?.display_name || user.email || "";

        // Query coins where owner_id != current user and recipient_name matches
        const { data, error } = await supabase
          .from("lovecoins")
          .select("*")
          .neq("owner_id", user.id)
          .ilike("recipient_name", `%${recipientName}%`)
          .order("created_at", { ascending: false });

        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: data || [] };
      },
      providesTags: ["ReceivedCoins"],
    }),

    // ------------------------------------------------------------------
    // uploadCoinPhoto — upload an image to the coin-photos Storage bucket.
    // Returns the public URL on success.
    // ------------------------------------------------------------------
    uploadCoinPhoto: build.mutation<string, { file: File; userId: string }>({
      queryFn: async ({ file, userId }, { dispatch }) => {
        const path = generateStoragePath(userId, file.name);

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.coinPhotos)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) return { error: interceptSupabaseError(uploadError, dispatch) };

        const {
          data: { publicUrl },
        } = supabase.storage.from(STORAGE_BUCKETS.coinPhotos).getPublicUrl(path);

        return { data: publicUrl };
      },
    }),
  }),
});

export const {
  useGetCoinsQuery,
  useGetCoinByNumberQuery,
  useGetMyCoinsQuery,
  useGetReceivedCoinsQuery,
  useUploadCoinPhotoMutation,
} = coinsApi;
