/**
 * create-bachs-checkout Edge Function
 *
 * Creates a Bachs Pure Checkout session for a pending LoveCoin purchase order.
 * This function runs server-side so the BACHS_API_KEY secret is never exposed
 * to the browser.
 *
 * Flow:
 *   1. Verify the caller's Supabase Auth JWT.
 *   2. Load and validate the purchase_order (must belong to caller, status=pending).
 *   3. Verify all requested coin numbers are currently unclaimed.
 *   4. Call Bachs API to create a Pure Checkout session with idempotency key.
 *   5. Update purchase_orders.bachs_checkout_id.
 *   6. Return { checkoutUrl } to the client.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.7, 4.8, 4.9, 4.10, 12.3, 21.2, 21.5
 */

// @ts-ignore — this file runs on Deno; the npm specifier is used so the
// project TypeScript compiler can resolve types from node_modules.
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  orderId: string;
  paymentReference: string;
  totalAmountKobo: number;
  coinNumbers: number[];
}

interface BachsCheckoutResponse {
  id: string;
  checkout_url: string;
  reference: string;
  status: string;
}

interface PurchaseOrder {
  id: string;
  user_id: string;
  payment_reference: string;
  coin_numbers: number[];
  total_amount_kobo: number;
  status: string;
  bachs_checkout_id: string | null;
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Kobo → Naira decimal string conversion (no floating-point arithmetic)
// Bachs API expects amount as decimal string, e.g. "1000.00" for ₦1000.
// ---------------------------------------------------------------------------

function koboToNairaString(kobo: number): string {
  const whole = Math.trunc(kobo / 100);
  const fraction = Math.abs(kobo % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  // ------------------------------------------------------------------
  // Step 1: Verify caller JWT via Supabase Auth
  // ------------------------------------------------------------------

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(401, "Missing or malformed Authorization header");
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // Caller client: used to verify the JWT and retrieve caller identity
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user: caller },
    error: authError,
  } = await callerClient.auth.getUser();

  if (authError || !caller) {
    return errorResponse(401, "Invalid or expired authentication token");
  }

  // ------------------------------------------------------------------
  // Step 2: Parse and validate request body
  // ------------------------------------------------------------------

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return errorResponse(400, "Invalid JSON request body");
  }

  const { orderId, paymentReference, totalAmountKobo, coinNumbers } = body;

  if (!orderId || !paymentReference || !totalAmountKobo || !Array.isArray(coinNumbers) || coinNumbers.length === 0) {
    return errorResponse(400, "Missing required fields: orderId, paymentReference, totalAmountKobo, coinNumbers");
  }

  // Enforce minimum purchase size (10 spots) on the server side as well
  if (coinNumbers.length < 10) {
    return errorResponse(400, "Minimum purchase is 10 coin spots");
  }

  // ------------------------------------------------------------------
  // Step 3: Load and validate the purchase_order (service-role client)
  // The service-role client bypasses RLS for authoritative reads.
  // ------------------------------------------------------------------

  // Admin client: bypasses RLS for privileged operations
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: order, error: orderError } = await adminClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("purchase_orders" as any)
    .select("id, user_id, payment_reference, coin_numbers, total_amount_kobo, status, bachs_checkout_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error("[create-bachs-checkout] Failed to load purchase_order:", orderError);
    return errorResponse(500, "Failed to load purchase order");
  }

  if (!order) {
    return errorResponse(403, "Purchase order not found");
  }

  const purchaseOrder = order as PurchaseOrder;

  // Verify ownership
  if (purchaseOrder.user_id !== caller.id) {
    console.warn(`[create-bachs-checkout] User ${caller.id} attempted to checkout order owned by ${purchaseOrder.user_id}`);
    return errorResponse(403, "Purchase order does not belong to the authenticated user");
  }

  // Verify status is pending
  if (purchaseOrder.status !== "pending") {
    return errorResponse(403, `Purchase order status is "${purchaseOrder.status}", expected "pending"`);
  }

  // Verify the coin numbers match (prevent tampering in the request body)
  const orderCoinNumbers: number[] = purchaseOrder.coin_numbers;
  const requestedSet = new Set(coinNumbers);
  const orderSet = new Set(orderCoinNumbers);
  const allMatch =
    requestedSet.size === orderSet.size &&
    [...requestedSet].every((n) => orderSet.has(n));

  if (!allMatch) {
    return errorResponse(403, "Requested coin numbers do not match the purchase order");
  }

  // ------------------------------------------------------------------
  // Step 4: Verify all coin numbers are currently unclaimed
  // ------------------------------------------------------------------

  const { data: existingCoins, error: coinsCheckError } = await adminClient
    .from("lovecoins")
    .select("coin_number")
    .in("coin_number", coinNumbers);

  if (coinsCheckError) {
    console.error("[create-bachs-checkout] Failed to check coin availability:", coinsCheckError);
    return errorResponse(500, "Failed to verify coin availability");
  }

  if (existingCoins && existingCoins.length > 0) {
    const claimedNumbers = existingCoins.map((c: { coin_number: number }) => c.coin_number);
    console.warn(`[create-bachs-checkout] Coins already claimed:`, claimedNumbers);
    return jsonResponse(
      { error: "One or more coins have already been claimed", claimedCoinNumbers: claimedNumbers },
      409,
    );
  }

  // ------------------------------------------------------------------
  // Step 5: Create Bachs Pure Checkout session
  // ------------------------------------------------------------------

  const bachsApiKey = requireEnv("BACHS_API_KEY");
  const bachsBaseUrl = Deno.env.get("BACHS_BASE_URL") || "https://api.bachs.co";
  const returnUrl = requireEnv("BACHS_RETURN_URL");
  const cancelUrl = requireEnv("BACHS_CANCEL_URL");

  const checkoutPayload = {
    amount: koboToNairaString(totalAmountKobo),
    currency: "NGN",
    customer_email: caller.email,
    reference: paymentReference,
    metadata: {
      user_id: caller.id,
      coin_numbers: coinNumbers,
      order_id: orderId,
    },
    success_url: returnUrl,
    cancel_url: cancelUrl,
  };

  let bachsResponse: BachsCheckoutResponse;
  try {
    const bachsReq = await fetch(`${bachsBaseUrl}/v1/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Req 4.1: secret key never leaves the server
        "Authorization": `Bearer ${bachsApiKey}`,
        // Req 4.2: Idempotency key = payment reference, prevents duplicate checkout sessions on retry
        "Idempotency-Key": paymentReference,
      },
      body: JSON.stringify(checkoutPayload),
    });

    if (!bachsReq.ok) {
      const errorBody = await bachsReq.text();
      console.error(`[create-bachs-checkout] Bachs API error ${bachsReq.status}:`, errorBody);
      return errorResponse(500, `Bachs API error: ${bachsReq.status}`);
    }

    bachsResponse = (await bachsReq.json()) as BachsCheckoutResponse;
  } catch (err) {
    console.error("[create-bachs-checkout] Bachs API request failed:", err);
    return errorResponse(500, "Failed to create Bachs checkout session");
  }

  if (!bachsResponse.checkout_url) {
    console.error("[create-bachs-checkout] Bachs response missing checkout_url:", bachsResponse);
    return errorResponse(500, "Bachs did not return a checkout URL");
  }

  // ------------------------------------------------------------------
  // Step 6: Update purchase_orders.bachs_checkout_id
  // ------------------------------------------------------------------

  const { error: updateError } = await adminClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("purchase_orders" as any)
    .update({ bachs_checkout_id: bachsResponse.id })
    .eq("id", orderId);

  if (updateError) {
    // Non-fatal: log it, but still return the checkout URL so the user can proceed.
    // The webhook will handle final reconciliation.
    console.error("[create-bachs-checkout] Failed to update bachs_checkout_id:", updateError);
  }

  // ------------------------------------------------------------------
  // Step 7: Return the checkout URL to the client
  // ------------------------------------------------------------------

  return jsonResponse({ checkoutUrl: bachsResponse.checkout_url }, 200);
});
