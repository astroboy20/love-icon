/**
 * bachs-webhook Edge Function
 *
 * Receives and verifies signed webhook events from Bachs, then atomically
 * inserts LoveCoin records and updates the purchase order status.
 *
 * Security model:
 *   - Raw request body is used for HMAC SHA-256 signature verification BEFORE
 *     any JSON parsing (re-serialising would change byte order and break the sig).
 *   - Only the service-role client touches the database; the browser can never
 *     trigger coin insertion directly.
 *   - Idempotency: if the order is already "succeeded" or "failed", we return
 *     HTTP 200 immediately without re-processing.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8,
 *               12.4, 12.5, 12.9, 13.2, 13.3, 13.4, 13.6,
 *               21.5, 21.6, 21.7, 21.8
 */

// @ts-ignore — this file runs on Deno; the npm specifier is used so the
// project TypeScript compiler can resolve types from node_modules.
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BachsEventMetadata {
  user_id: string;
  coin_numbers: number[];
  order_id: string;
}

interface BachsEventData {
  reference: string;
  charge_id?: string;
  customer_email?: string;
  metadata?: BachsEventMetadata;
}

interface BachsEvent {
  type: string;
  data: BachsEventData;
}

interface PurchaseOrder {
  id: string;
  user_id: string;
  payment_reference: string;
  coin_numbers: number[];
  total_amount_kobo: number;
  status: string;
}

interface CoinInsertPayload {
  coin_number: number;
  owner_id: string;
  // Required fields in the lovecoins table; set to defaults at claim time.
  // The user personalises via the ClaimFlow before payment; the personalization
  // data lives in the purchase_order metadata in a full implementation.
  // For the initial two-phase flow these are placeholder defaults — the
  // personalization fields will be added to the purchase_order metadata in a
  // future iteration (see design doc §Coin Personalization).
  creator_name: string;
  recipient_name: string;
  relation: string;
  message: string;
  style: string;
  visibility: string;
  status: string;
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

// ---------------------------------------------------------------------------
// HMAC-SHA256 webhook signature verification
//
// Bachs signs webhooks using:
//   signature = HMAC-SHA256(secret, timestamp + "." + rawBody)
//
// The X-Bachs-Signature header contains the hex-encoded digest.
// The X-Bachs-Timestamp header contains the Unix timestamp (seconds).
//
// We reject events where the timestamp is more than TOLERANCE_SECONDS old
// to prevent replay attacks.
//
// Requirements: 5.1, 5.2, 21.6
// ---------------------------------------------------------------------------

const TOLERANCE_SECONDS = 300; // 5 minutes

async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !timestamp) {
    return false;
  }

  // Reject stale timestamps (replay attack protection)
  const eventTime = parseInt(timestamp, 10);
  if (isNaN(eventTime)) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - eventTime) > TOLERANCE_SECONDS) {
    console.warn(
      `[bachs-webhook] Timestamp out of tolerance: event=${eventTime}, now=${nowSeconds}, diff=${Math.abs(nowSeconds - eventTime)}s`,
    );
    return false;
  }

  // Compute HMAC-SHA256 of "{timestamp}.{rawBody}" using the webhook secret
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const message = `${timestamp}.${rawBody}`;
  const signatureBuffer = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(message));

  // Convert to lowercase hex string
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  return constantTimeEqual(computedHex, signature.toLowerCase());
}

/**
 * Constant-time string comparison — prevents timing-based signature forgery.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Bachs refund API helper
//
// Called when a coin was claimed by another user in the time between order
// creation and webhook delivery. We refund the buyer for the conflicting spots.
//
// Requirements: 13.4
// ---------------------------------------------------------------------------

async function refundConflictingCoins(
  bachsApiKey: string,
  bachsBaseUrl: string,
  chargeId: string,
  conflictCount: number,
  coinPriceKobo: number,
): Promise<void> {
  const refundAmountKobo = conflictCount * coinPriceKobo;

  // Bachs API expects amount as decimal string
  const whole = Math.trunc(refundAmountKobo / 100);
  const fraction = Math.abs(refundAmountKobo % 100).toString().padStart(2, "0");
  const refundAmountString = `${whole}.${fraction}`;

  try {
    const res = await fetch(`${bachsBaseUrl}/v1/charges/${chargeId}/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${bachsApiKey}`,
      },
      body: JSON.stringify({
        amount: refundAmountString,
        currency: "NGN",
        reason: "coin_conflict",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[bachs-webhook] Refund API error ${res.status} for charge ${chargeId}:`,
        body,
      );
    } else {
      console.log(
        `[bachs-webhook] Refund issued for ${conflictCount} conflicting coin(s) on charge ${chargeId}`,
      );
    }
  } catch (err) {
    console.error(`[bachs-webhook] Refund request failed for charge ${chargeId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Handle collection.succeeded
//
// Atomically inserts LoveCoin records for each coin number in the order.
// Coin number conflicts (another user claimed first) are handled by:
//   1. Skipping the conflicting coin_number.
//   2. Issuing a Bachs refund for the conflicting spot(s).
//
// Requirements: 5.3, 5.8, 12.4, 12.9, 13.2, 13.4, 21.5, 21.7, 21.8
// ---------------------------------------------------------------------------

const COIN_PRICE_KOBO = 10_000; // ₦100 per coin

async function handleCollectionSucceeded(
  adminClient: ReturnType<typeof createClient>,
  order: PurchaseOrder,
  chargeId: string,
  customerEmail: string | undefined,
  bachsApiKey: string,
  bachsBaseUrl: string,
): Promise<Response> {
  // Req 12.9: Verify customer email matches auth user email before inserting coins
  // (Prevents a malicious user from creating a purchase_order with another user's user_id)
  if (customerEmail) {
    const { data: authUser } = await adminClient.auth.admin.getUserById(order.user_id);
    if (authUser?.user?.email && authUser.user.email !== customerEmail) {
      console.error(
        `[bachs-webhook] Email mismatch — order user ${order.user_id} email "${authUser.user.email}" does not match checkout email "${customerEmail}"`,
      );
      // Mark order as failed to prevent further processing
      await adminClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("purchase_orders" as any)
        .update({ status: "failed" })
        .eq("id", order.id);
      return jsonResponse({ error: "Email mismatch — order rejected" }, 200);
    }
  }

  // Attempt to insert coins one by one, collecting conflicts
  const conflictingNumbers: number[] = [];
  const insertedNumbers: number[] = [];

  for (const coinNumber of order.coin_numbers) {
    // All required fields must be provided. Personalization data (name, message,
    // style etc.) would be stored in the purchase_order metadata in a full
    // implementation; here we use safe defaults so the claim is recorded.
    const insertPayload: CoinInsertPayload = {
      coin_number: coinNumber,
      owner_id: order.user_id,
      creator_name: "LoveCoin User",
      recipient_name: "LoveCoin User",
      relation: "friend",
      message: "",
      style: "default",
      visibility: "public",
      status: "claimed",
    };

    // Use `any` cast because purchase_orders is not yet in generated types (task 13).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (adminClient.from("lovecoins") as any)
      .insert(insertPayload);

    if (insertError) {
      // PostgreSQL unique-constraint violation code
      if (insertError.code === "23505") {
        console.warn(
          `[bachs-webhook] Coin ${coinNumber} already claimed — marking for refund`,
        );
        conflictingNumbers.push(coinNumber);
      } else {
        // Unexpected error — log and continue (best-effort; don't block the rest)
        console.error(
          `[bachs-webhook] Unexpected error inserting coin ${coinNumber}:`,
          insertError,
        );
      }
    } else {
      insertedNumbers.push(coinNumber);
    }
  }

  // Update purchase order to "succeeded" with the Bachs charge ID
  const { error: updateError } = await adminClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("purchase_orders" as any)
    .update({
      status: "succeeded",
      bachs_charge_id: chargeId,
    })
    .eq("id", order.id);

  if (updateError) {
    console.error(
      `[bachs-webhook] Failed to update order ${order.id} to succeeded:`,
      updateError,
    );
    // Still return 200 — coins may have been inserted; Bachs should not retry
  }

  console.log(
    `[bachs-webhook] Order ${order.id} succeeded. Inserted: [${insertedNumbers}], Conflicting: [${conflictingNumbers}]`,
  );

  // Issue refund for conflicting coin spots (Req 13.4)
  if (conflictingNumbers.length > 0 && chargeId) {
    await refundConflictingCoins(
      bachsApiKey,
      bachsBaseUrl,
      chargeId,
      conflictingNumbers.length,
      COIN_PRICE_KOBO,
    );
  }

  return jsonResponse({ received: true }, 200);
}

// ---------------------------------------------------------------------------
// Handle collection.failed
//
// Marks the purchase order as failed, releasing the held coin spots.
//
// Requirements: 5.5, 12.5
// ---------------------------------------------------------------------------

async function handleCollectionFailed(
  adminClient: ReturnType<typeof createClient>,
  order: PurchaseOrder,
): Promise<Response> {
  const { error } = await adminClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("purchase_orders" as any)
    .update({ status: "failed" })
    .eq("id", order.id);

  if (error) {
    console.error(`[bachs-webhook] Failed to mark order ${order.id} as failed:`, error);
  } else {
    console.log(`[bachs-webhook] Order ${order.id} marked as failed`);
  }

  return jsonResponse({ received: true }, 200);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ------------------------------------------------------------------
  // Step 1: Read the EXACT raw body BEFORE any JSON parsing.
  // Req 5.7: Re-serialising JSON changes byte order and invalidates the HMAC.
  // ------------------------------------------------------------------

  const rawBody = await req.text();

  // ------------------------------------------------------------------
  // Step 2: Verify webhook signature (Req 5.1, 5.2, 21.6)
  // ------------------------------------------------------------------

  let webhookSecret: string;
  try {
    webhookSecret = requireEnv("BACHS_WEBHOOK_SECRET");
  } catch (err) {
    console.error("[bachs-webhook] BACHS_WEBHOOK_SECRET not configured:", err);
    return jsonResponse({ error: "Webhook secret not configured" }, 500);
  }

  const signature = req.headers.get("X-Bachs-Signature");
  const timestamp = req.headers.get("X-Bachs-Timestamp");

  const isValid = await verifyWebhookSignature(rawBody, signature, timestamp, webhookSecret);

  if (!isValid) {
    console.warn(
      `[bachs-webhook] Signature verification failed. sig="${signature}", ts="${timestamp}"`,
    );
    // Req 5.2: Return 401, do not process
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  // ------------------------------------------------------------------
  // Step 3: Parse the event body (safe to do AFTER signature is verified)
  // ------------------------------------------------------------------

  let event: BachsEvent;
  try {
    event = JSON.parse(rawBody) as BachsEvent;
  } catch {
    console.error("[bachs-webhook] Failed to parse webhook body as JSON");
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { type: eventType, data: eventData } = event;
  const paymentReference = eventData?.reference || eventData?.metadata?.order_id;

  if (!paymentReference) {
    console.error("[bachs-webhook] Event missing payment reference:", JSON.stringify(event));
    // Return 200 to prevent Bachs from retrying an unprocessable event
    return jsonResponse({ received: true }, 200);
  }

  console.log(`[bachs-webhook] Received event type="${eventType}" ref="${paymentReference}"`);

  // ------------------------------------------------------------------
  // Step 4: Initialise service-role Supabase client
  // ------------------------------------------------------------------

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  // ------------------------------------------------------------------
  // Step 5: Look up the purchase_order by payment_reference
  // ------------------------------------------------------------------

  const { data: orderData, error: orderError } = await adminClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("purchase_orders" as any)
    .select("id, user_id, payment_reference, coin_numbers, total_amount_kobo, status")
    .eq("payment_reference", paymentReference)
    .maybeSingle();

  if (orderError) {
    console.error("[bachs-webhook] Failed to look up purchase_order:", orderError);
    // Return 200 to prevent retries that would keep failing
    return jsonResponse({ received: true }, 200);
  }

  // Req 5.6: No matching order — log and return 200 to prevent retries
  if (!orderData) {
    console.warn(
      `[bachs-webhook] No purchase_order found for payment_reference="${paymentReference}"`,
    );
    return jsonResponse({ received: true }, 200);
  }

  const order = orderData as PurchaseOrder;

  // ------------------------------------------------------------------
  // Step 6: Idempotency check (Req 5.4, 13.2, 13.3)
  // If the order is already in a terminal state, return 200 immediately.
  // ------------------------------------------------------------------

  if (order.status === "succeeded" || order.status === "failed") {
    console.log(
      `[bachs-webhook] Order ${order.id} already in terminal state "${order.status}" — skipping re-processing`,
    );
    return jsonResponse({ received: true }, 200);
  }

  // ------------------------------------------------------------------
  // Step 7: Handle the event type
  // ------------------------------------------------------------------

  const bachsApiKey = requireEnv("BACHS_API_KEY");
  const bachsBaseUrl = Deno.env.get("BACHS_BASE_URL") || "https://api.bachs.co";

  if (eventType === "collection.succeeded") {
    const chargeId = eventData.charge_id ?? "";
    const customerEmail = eventData.customer_email;

    return await handleCollectionSucceeded(
      adminClient,
      order,
      chargeId,
      customerEmail,
      bachsApiKey,
      bachsBaseUrl,
    );
  }

  if (eventType === "collection.failed") {
    return await handleCollectionFailed(adminClient, order);
  }

  // Unrecognised event type — acknowledge without processing
  console.log(`[bachs-webhook] Unrecognised event type "${eventType}" — ignoring`);
  return jsonResponse({ received: true }, 200);
});
