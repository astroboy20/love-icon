/**
 * RTK Query API slice for purchase orders and Bachs payment processing.
 *
 * Manages the two-phase claim flow:
 *   1. Client creates a pending `purchase_order` (this slice)
 *   2. Client invokes the `create-bachs-checkout` Edge Function (this slice)
 *   3. User completes payment on Bachs hosted checkout
 *   4. Client polls order status until webhook updates it (this slice)
 *
 * The `purchase_orders` table does not exist until migration 0001 is applied.
 * The type definition below mirrors the design document schema.
 *
 * Tag types:
 *   "PurchaseOrder" — invalidated after create / cancel
 *
 * Requirements: 4.1, 4.3, 4.4, 11.2, 12.2, 12.6, 22.4
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseBaseQuery, interceptSupabaseError } from "@/lib/api/supabaseBaseQuery";
import { EDGE_FUNCTIONS } from "@/lib/config/app";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PurchaseOrderStatus = "pending" | "succeeded" | "failed" | "cancelled";

export interface PurchaseOrder {
  id: string;
  user_id: string;
  payment_reference: string;
  coin_numbers: number[];
  total_amount_kobo: number;
  status: PurchaseOrderStatus;
  bachs_checkout_id: string | null;
  bachs_charge_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CreatePurchaseOrderArgs {
  coinNumbers: number[];
  totalAmountKobo: number;
  paymentReference: string;
}

interface CreateBachsCheckoutArgs {
  orderId: string;
  paymentReference: string;
  totalAmountKobo: number;
  coinNumbers: number[];
}

interface CreateBachsCheckoutResult {
  checkoutUrl: string;
}

// ---------------------------------------------------------------------------
// paymentsApi
// ---------------------------------------------------------------------------

export const paymentsApi = createApi({
  reducerPath: "paymentsApi",
  baseQuery: supabaseBaseQuery,
  tagTypes: ["PurchaseOrder"],
  endpoints: (build) => ({
    // ------------------------------------------------------------------
    // createPurchaseOrder — insert a pending purchase order row.
    // Called before invoking the Edge Function.
    // RLS ensures user_id = auth.uid() and status = 'pending'.
    // ------------------------------------------------------------------
    createPurchaseOrder: build.mutation<PurchaseOrder, CreatePurchaseOrderArgs>({
      queryFn: async ({ coinNumbers, totalAmountKobo, paymentReference }, { dispatch }) => {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return {
            error: { status: 401, message: "Not authenticated. Please sign in before purchasing." },
          };
        }

        // purchase_orders table is created in migration 0001.
        // Using `any` cast because the type is not yet in the generated types file;
        // it will be added in task 13 (TypeScript type regen).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from("purchase_orders" as any) as any)
          .insert({
            user_id: user.id,
            payment_reference: paymentReference,
            coin_numbers: coinNumbers,
            total_amount_kobo: totalAmountKobo,
            status: "pending",
          })
          .select()
          .single();

        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: data as PurchaseOrder };
      },
      invalidatesTags: ["PurchaseOrder"],
    }),

    // ------------------------------------------------------------------
    // createBachsCheckout — invoke the create-bachs-checkout Edge Function.
    // Returns the Bachs hosted checkout URL. The client then redirects the
    // user to that URL.
    // ------------------------------------------------------------------
    createBachsCheckout: build.mutation<CreateBachsCheckoutResult, CreateBachsCheckoutArgs>({
      queryFn: async (args, { dispatch }) => {
        const { data, error } = await supabase.functions.invoke<CreateBachsCheckoutResult>(
          EDGE_FUNCTIONS.createBachsCheckout,
          { body: args },
        );

        if (error) return { error: interceptSupabaseError(error, dispatch) };
        if (!data?.checkoutUrl) {
          return {
            error: { status: "UNKNOWN", message: "Edge Function did not return a checkout URL." },
          };
        }

        return { data };
      },
    }),

    // ------------------------------------------------------------------
    // getOrderStatus — poll the status of a purchase order by its ID.
    // Used after Bachs redirects back to the return URL; the client polls
    // until the webhook transitions the order to "succeeded" or "failed".
    // ------------------------------------------------------------------
    getOrderStatus: build.query<PurchaseOrder | null, string>({
      queryFn: async (orderId, { dispatch }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from("purchase_orders" as any) as any)
          .select("*")
          .eq("id", orderId)
          .maybeSingle();

        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: (data as PurchaseOrder) || null };
      },
      providesTags: (_result, _error, orderId) => [{ type: "PurchaseOrder", id: orderId }],
    }),

    // ------------------------------------------------------------------
    // cancelPurchaseOrder — transition a pending order to "cancelled".
    // RLS permits this update only when status = 'pending' and
    // user_id = auth.uid(), preventing cancellation of completed orders.
    // ------------------------------------------------------------------
    cancelPurchaseOrder: build.mutation<void, string>({
      queryFn: async (orderId, { dispatch }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("purchase_orders" as any) as any)
          .update({ status: "cancelled" })
          .eq("id", orderId);

        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: undefined };
      },
      invalidatesTags: (_result, _error, orderId) => [
        "PurchaseOrder",
        { type: "PurchaseOrder", id: orderId },
      ],
    }),
  }),
});

export const {
  useCreatePurchaseOrderMutation,
  useCreateBachsCheckoutMutation,
  useGetOrderStatusQuery,
  useCancelPurchaseOrderMutation,
} = paymentsApi;
