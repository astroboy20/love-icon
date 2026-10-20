/**
 * RTK Query API slice for LoveCoin sharing.
 *
 * Provides endpoints for fetching shareable coin data and generating
 * share links. Share links are simple URLs derived from the coin number
 * and the current origin (e.g. `https://lovecoin.app/coin/42`).
 *
 * Tag types:
 *   "Coin" — shared with coinsApi so coin detail data is cached consistently
 *
 * Requirements: 22.4
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseBaseQuery, interceptSupabaseError } from "@/lib/api/supabaseBaseQuery";
import type { Tables } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoveCoin = Tables<"lovecoins">;

// ---------------------------------------------------------------------------
// sharingApi
// ---------------------------------------------------------------------------

export const sharingApi = createApi({
  reducerPath: "sharingApi",
  baseQuery: supabaseBaseQuery,
  tagTypes: ["Coin"],
  endpoints: (build) => ({
    // ------------------------------------------------------------------
    // getShareableCoin — fetch a coin's public data by coin number.
    // Coins with visibility = "private" are excluded by RLS unless the
    // calling user is the owner.
    // ------------------------------------------------------------------
    getShareableCoin: build.query<LoveCoin | null, number>({
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
    // createShareLink — generate a shareable URL for a coin.
    // Returns the full URL string. Uses the Web Share API in components
    // (see ShareKeepsakeButton) with copy-link as fallback.
    // ------------------------------------------------------------------
    createShareLink: build.mutation<string, { coinNumber: number }>({
      queryFn: async ({ coinNumber }) => {
        // Construct the share URL from the current origin.
        // This is a client-side operation — no Supabase call needed.
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "";
        const shareUrl = `${origin}/coin/${coinNumber}`;
        return { data: shareUrl };
      },
    }),
  }),
});

export const {
  useGetShareableCoinQuery,
  useCreateShareLinkMutation,
} = sharingApi;
