# Requirements Document

## Introduction

LoveCoin is a Nigerian-market emotional keepsake app where users claim numbered coins from a billion-coin heart visualization, personalize them, and pay to permanently own them. The app also features a social "Love of Fame" feed of LoveNotes with emoji reactions. The Supabase backend is partially wired: auth, basic CRUD for coins/notes/reactions, and profile auto-creation are functional. This spec covers the remaining integration work to fully connect the app to its Supabase backend, including image uploads via Supabase Storage, Bachs payment processing with idempotency, profile management, real-time subscriptions, race-condition handling for coin claims, OAuth redirect handling, a proper "received coins" concept, and TypeScript type generation from the database schema.

### Pricing Model

Each individual LoveCoin costs ₦100. However, the minimum purchase is ₦1000, which means a user must claim at least 10 coin spots in a single transaction. A user may claim more than 10 spots (in increments of ₦100), but never fewer than 10. This minimum applies to every checkout session.

## Glossary

- **LoveCoin_App**: The LoveCoin web application, including all client-side and server-side code.
- **Supabase_Client**: The Supabase JavaScript client instance configured with the publishable key, used for client-side operations.
- **Supabase_Edge_Function**: A serverless Deno function deployed on Supabase that runs server-side with access to Edge Function secrets (e.g. `BACHS_API_KEY`, `BACHS_WEBHOOK_SECRET`) and the service-role Supabase client. Used for the Bachs checkout session creation and the Bachs webhook receiver, since these operations require secrets that must never reach the browser.
- **Supabase_Admin_Client**: The Supabase JavaScript client instance configured with the service role key, used inside Supabase Edge Functions for server-side operations that bypass RLS. Never imported or reachable from client-side code.
- **Supabase_Storage**: The Supabase file storage service used for hosting user-uploaded images.
- **Storage_Bucket**: A named container in Supabase Storage holding uploaded files, with its own RLS policies.
- **Bachs**: The payment and billing platform (bachs.io) used to process LoveCoin claim payments via hosted checkout sessions. Supports cards, mobile money, bank transfer, and stablecoin across 150+ currencies with settlement to African bank accounts.
- **Bachs_Hosted_Checkout**: A Bachs-hosted checkout page that the user is redirected to in order to enter payment details. Bachs handles card entry and charge; the app never touches card details.
- **Bachs_Webhook**: A server-side endpoint that receives signed event notifications from Bachs (using `X-Bachs-Timestamp` and `X-Bachs-Signature` headers with HMAC SHA-256) to verify transaction completion.
- **Bachs_Checkout_Session**: A Bachs resource created via the Bachs API that represents a single checkout flow. The app creates a session, redirects the user to Bachs, and Bachs redirects back to a return URL with `checkout_id` after payment.
- **Bachs_Pure_Checkout**: A Bachs checkout mode where the amount and currency are specified at runtime, without pre-creating Bachs products. Used for LoveCoin purchases where the total depends on the number of spots selected.
- **Bachs_Charge**: A Bachs resource representing a completed charge. Verified server-side by `chargeId` via the Bachs API after webhook delivery.
- **Idempotency_Key**: A client-supplied unique identifier sent in the `Idempotency-Key` HTTP header to Bachs API requests. Bachs caches the result for a request with a given key and returns the same response for duplicate requests, preventing double-charges on retries.
- **Idempotency**: The property that retrying an operation produces the same outcome as performing it once. In the LoveCoin context: a retried checkout session creation, a retried webhook processing, and a retried coin claim insert must never result in duplicate charges or duplicate coin records.
- **LoveCoin**: A numbered, personalized keepsake entry in the `lovecoins` table. Each has a unique `coin_number`, an owner, creator name, recipient name, relation, message, optional photo, style, and visibility.
- **LoveNote**: A short love story entry in the `lovenotes` table, optionally linked to a LoveCoin, with a category, love type, optional photo, and seed reactions.
- **Reaction**: An emoji reaction entry in the `reactions` table, linked to a LoveNote and a user, with a reaction type.
- **Profile**: A user profile entry in the `profiles` table, auto-created on signup, containing a display name.
- **ClaimFlow**: The multi-step modal component that guides a user through personalizing and purchasing one or more LoveCoins.
- **LoveNoteComposer**: The modal component for writing and publishing a LoveNote.
- **HeartGrid**: The SVG heart visualization with clickable cells representing coin spaces.
- **Store**: The Redux store (via Redux Toolkit's `configureStore`) that holds all server state (through RTK Query API slices) and cross-component UI state (through RTK slices). Replaces the previous `LoveProvider` context-based store.
- **RTK**: Redux Toolkit, the official Redux development library, used for the Redux store configuration and feature slices.
- **RTK_Query**: RTK Query, the data-fetching and caching library built into Redux Toolkit, used for all API interactions with Supabase. Wraps the Supabase JS client in `queryFn` handlers and provides built-in caching, invalidation, loading/error states, and optimistic updates.
- **RTK_API_Slice**: A per-feature RTK Query API slice (created with `createApi`) that defines endpoints for a single feature's data operations (e.g., `coinsApi`, `paymentsApi`, `fameApi`).
- **RTK_Slice**: A Redux Toolkit slice (created with `createSlice`) for cross-component UI state that is not server state (e.g., selected coin numbers in the HeartGrid).
- **Coin_Number_Conflict**: A race condition where two users simultaneously attempt to claim the same coin number, causing a unique constraint violation.
- **Received_Coin**: A LoveCoin that a user did not create but that is associated with them as the recipient.
- **TypeScript_Database_Types**: The auto-generated TypeScript types in `src/integrations/supabase/types.ts` that mirror the Supabase database schema.
- **RLS**: Row-Level Security policies in Supabase that control which rows a user can read, insert, update, or delete.
- **Auth_Session**: The Supabase authentication session containing the user's access token and metadata.
- **OAuth_Redirect**: The URL that the OAuth provider redirects to after successful authentication.
- **Payment_Reference**: A unique identifier generated for each payment transaction, used to correlate Bachs checkout sessions and charges with LoveCoin claim records. Also used as the idempotency key for the Bachs checkout session creation.
- **Coin_Spot**: A single selectable position on the HeartGrid representing one LoveCoin. Each spot costs ₦100.
- **Purchase_Order**: A server-side record representing a user's intent to purchase one or more coin spots in a single transaction. Tracks the payment reference, selected coin numbers, total amount, and payment status (pending, succeeded, failed).

## Requirements

### Requirement 1: Supabase Storage Bucket Setup

**User Story:** As a developer, I want to create and configure Supabase Storage buckets for user-uploaded images, so that coin photos and note photos can be stored securely and served efficiently.

#### Acceptance Criteria

1. THE Supabase_Storage SHALL have two buckets: `coin-photos` for LoveCoin images and `note-photos` for LoveNote images.
2. THE Supabase_Storage SHALL mark both buckets as public-readable so that image URLs are accessible without authentication.
3. THE Supabase_Storage SHALL restrict bucket writes to authenticated users only, enforced via storage RLS policies.
4. THE Supabase_Storage SHALL limit uploaded file size to 5 MB per file.
5. THE Supabase_Storage SHALL accept only image MIME types (image/jpeg, image/png, image/webp, image/gif) for uploads.

### Requirement 2: LoveCoin Image Upload Flow

**User Story:** As a user, I want my LoveCoin photo to be uploaded to Supabase Storage, so that it loads quickly from a CDN instead of being stored as a large base64 string in the database.

#### Acceptance Criteria

1. WHEN a user selects a photo in the ClaimFlow, THE LoveCoin_App SHALL upload the image to the `coin-photos` bucket in Supabase_Storage before inserting the LoveCoin record.
2. WHEN an image upload succeeds, THE Store SHALL store the resulting public Storage URL in the `image_url` field of the LoveCoin record instead of a base64 data URL.
3. WHEN an image upload fails, THE LoveCoin_App SHALL display an error message to the user and SHALL NOT proceed with the LoveCoin claim.
4. WHEN no photo is selected, THE LoveCoin_App SHALL proceed with the claim flow and set `image_url` to null.
5. THE LoveCoin_App SHALL generate a unique file path for each uploaded image using the user ID and a timestamp to prevent filename collisions.

### Requirement 3: LoveNote Image Upload Flow

**User Story:** As a user, I want my LoveNote photo to be uploaded to Supabase Storage, so that it loads quickly from a CDN instead of being stored as a large base64 string in the database.

#### Acceptance Criteria

1. WHEN a user selects a photo in the LoveNoteComposer, THE LoveCoin_App SHALL upload the image to the `note-photos` bucket in Supabase_Storage before inserting the LoveNote record.
2. WHEN an image upload succeeds, THE Store SHALL store the resulting public Storage URL in the `image_url` field of the LoveNote record instead of a base64 data URL.
3. WHEN an image upload fails, THE LoveCoin_App SHALL display an error message and SHALL NOT proceed with publishing the LoveNote.
4. WHEN no photo is selected, THE LoveCoin_App SHALL proceed with publishing the LoveNote and set `image_url` to null.
5. THE LoveCoin_App SHALL generate a unique file path for each uploaded image using the user ID and a timestamp to prevent filename collisions.

### Requirement 4: Bachs Payment Integration

**User Story:** As a user, I want to pay for my LoveCoin purchases using Bachs, so that my payment is processed securely through a payment platform that supports Nigerian settlement and multiple payment methods.

#### Acceptance Criteria

1. WHEN a user initiates a checkout, THE LoveCoin_App SHALL invoke a Supabase Edge Function that creates a Bachs Pure Checkout session by calling the Bachs API server-side with the `BACHS_API_KEY` (stored as an Edge Function secret, never exposed to the client), passing the total amount (in the smallest currency unit, e.g. kobo for NGN), the currency code, the user's email, a unique payment reference, and the return/cancel URLs.
2. WHEN creating the Bachs checkout session, THE Edge Function SHALL pass the `Idempotency-Key` HTTP header set to the payment reference, so that a retried request returns the same checkout session instead of creating a duplicate.
3. WHEN the Bachs checkout session is created, THE Edge Function SHALL return the Bachs-hosted checkout URL to the client, and THE LoveCoin_App SHALL redirect the user to that URL.
4. WHEN Bachs redirects the user back to the return URL after payment, THE LoveCoin_App SHALL read the `checkout_id` query parameter and SHALL display a "confirming your payment" state to the user; the client SHALL NOT insert LoveCoin records based on the redirect alone.
5. WHEN the Bachs webhook (processed by the Supabase Edge Function in Requirement 5) confirms a successful `collection.succeeded` event, the LoveCoin records SHALL be inserted by the Edge Function using the service-role client. The client SHALL poll the Purchase_Order status (or receive a real-time update) and SHALL navigate the user to their coin detail page only after the Purchase_Order status transitions to "succeeded".
6. WHEN the Bachs checkout indicates the charge failed or the user cancels (redirects to the cancel URL), THE LoveCoin_App SHALL display an error message and SHALL NOT insert any LoveCoin records; the Purchase_Order status SHALL remain "pending" or be set to "cancelled" by the client (RLS-permitted only when status is "pending").
7. WHEN `BACHS_API_KEY` is not configured as an Edge Function secret, THE Edge Function SHALL return an error and SHALL NOT fall back to the mock charge in production. The mock charge SHALL only be available in local development outside the Edge Function path, and SHALL log a warning that the mock provider is active.
8. THE LoveCoin_App SHALL generate a unique payment reference for each checkout attempt using the format `lovecoin-{userId}-{timestamp}`.
9. THE Edge Function SHALL store metadata on the Bachs checkout session identifying the user ID, the selected coin numbers, and the purchase order ID so that the webhook can reconcile the payment to the correct coins.
10. THE Edge Function SHALL verify, before creating the Bachs checkout session, that the calling user is authenticated (via the Supabase Auth JWT passed in the `Authorization` header) and that the requested coin numbers are all currently unclaimed, rejecting the request if any coin is already claimed.

### Requirement 5: Bachs Webhook Verification

**User Story:** As a developer, I want a Supabase Edge Function webhook endpoint to verify Bachs payments with idempotency, so that payment success is confirmed by Bachs before LoveCoins are permanently marked as claimed, and so that retried webhook deliveries do not result in duplicate coin claims.

#### Acceptance Criteria

1. THE LoveCoin_App SHALL deploy a Supabase Edge Function that receives Bachs webhook events and verifies the `X-Bachs-Timestamp` and `X-Bachs-Signature` headers using HMAC SHA-256 with the `BACHS_WEBHOOK_SECRET` stored as an Edge Function secret (never exposed to the client).
2. WHEN a webhook event has an invalid signature or a timestamp outside the allowed tolerance window, THE Edge Function SHALL reject the event with an HTTP 401 status and SHALL NOT process the event.
3. WHEN a `collection.succeeded` event is received and verified, THE Edge Function SHALL use the service-role Supabase client to locate the pending Purchase_Order by the payment reference in the event metadata, and SHALL insert the LoveCoin records and transition the order to "succeeded" inside a single atomic database transaction.
4. WHEN a webhook event is received with a payment reference whose Purchase_Order status is already "succeeded", THE Edge Function SHALL return an HTTP 200 status without re-processing, ensuring webhook idempotency.
5. WHEN a `collection.failed` event is received, THE Edge Function SHALL mark the Purchase_Order status as "failed" and SHALL release the held coin spots back to available.
6. WHEN a webhook event references a payment reference that does not match any pending Purchase_Order, THE Edge Function SHALL log the discrepancy and return an HTTP 200 status to prevent retries.
7. THE Edge Function SHALL always use the exact raw request body for signature verification and SHALL NOT rely on a re-serialized JSON body, which would cause signature validation to fail.
8. THE LoveCoin_App SHALL always grant the claimed coins based on the webhook-confirmed payment state processed by the Edge Function, never on the checkout redirect URL alone, to prevent a user from receiving coins without a verified payment.

### Requirement 6: Profile Management

**User Story:** As a user, I want to edit my display name, so that my LoveCoins and LoveNotes are attributed to the name I choose.

#### Acceptance Criteria

1. THE LoveCoin_App SHALL provide a profile editing interface accessible from the My LoveCoins page when the user is authenticated.
2. WHEN a user submits a new display name, THE Supabase_Client SHALL update the `display_name` field in the `profiles` table for that user.
3. WHEN the display name update succeeds, THE Store SHALL update the `currentUser.display_name` in the application state without requiring a full page reload.
4. WHEN the display name update fails, THE LoveCoin_App SHALL display an error message to the user.
5. THE profiles table RLS policy SHALL allow each authenticated user to update only their own profile row.

### Requirement 7: Real-time Subscriptions for LoveCoins

**User Story:** As a user exploring the HeartGrid, I want to see newly claimed coins appear in real time, so that the heart visualization reflects the current state without manual refresh.

#### Acceptance Criteria

1. WHEN the LoveCoin_App loads, THE Store SHALL subscribe to the Supabase real-time channel for INSERT events on the `lovecoins` table.
2. WHEN a new LoveCoin is inserted by any user, THE Store SHALL add the new coin to the local coins state array.
3. WHEN a LoveCoin is inserted with a visibility of "private", THE Store SHALL NOT add the coin to the local state unless the current user is the owner.
4. WHEN the LoveCoin_App unmounts or the user signs out, THE Store SHALL unsubscribe from the real-time channel to prevent memory leaks.
5. WHEN a real-time event is received but the coin already exists in local state, THE Store SHALL deduplicate and SHALL NOT add a duplicate entry.

### Requirement 8: Real-time Subscriptions for LoveNotes

**User Story:** As a user browsing the Love of Fame feed, I want to see new LoveNotes appear in real time, so that the feed feels alive without manual refresh.

#### Acceptance Criteria

1. WHEN the LoveCoin_App loads, THE Store SHALL subscribe to the Supabase real-time channel for INSERT events on the `lovenotes` table.
2. WHEN a new LoveNote is inserted by any user, THE Store SHALL add the new note to the local notes state array and update the `claimedCount` if applicable.
3. WHEN a new LoveNote is inserted, THE Love_of_Fame page SHALL render the new note in the correct day group without requiring a manual refresh.
4. WHEN the LoveCoin_App unmounts or the user signs out, THE Store SHALL unsubscribe from the real-time channel.
5. WHEN a real-time event is received but the note already exists in local state, THE Store SHALL deduplicate and SHALL NOT add a duplicate entry.

### Requirement 9: Real-time Subscriptions for Reactions

**User Story:** As a user viewing the Love of Fame feed, I want to see reaction counts update in real time, so that the social engagement feels current.

#### Acceptance Criteria

1. WHEN the LoveCoin_App loads, THE Store SHALL subscribe to the Supabase real-time channel for INSERT and DELETE events on the `reactions` table.
2. WHEN a new reaction is inserted by any user, THE Store SHALL update the reaction count for that LoveNote and reaction type.
3. WHEN a reaction is deleted by any user, THE Store SHALL decrement the reaction count for that LoveNote and reaction type.
4. WHEN the LoveCoin_App unmounts or the user signs out, THE Store SHALL unsubscribe from the real-time channel.
5. THE Store SHALL NOT subscribe to reactions real-time events when the user is on a page that does not display LoveNotes.

### Requirement 10: Coin Number Conflict Handling

**User Story:** As a user claiming a LoveCoin, I want the app to handle the case where another user claimed the same coin simultaneously, so that I receive a clear message instead of a silent failure.

#### Acceptance Criteria

1. WHEN the `claimCoin` function receives a unique constraint violation error on `coin_number` from Supabase, THE Store SHALL return a specific error code indicating a coin number conflict, distinct from other error types.
2. WHEN a coin number conflict occurs, THE ClaimFlow SHALL display a message telling the user the coin was just claimed and prompting them to pick another spot on the heart.
3. WHEN a coin number conflict occurs, THE ClaimFlow SHALL NOT navigate the user to the coin detail page.
4. WHEN a coin number conflict occurs, THE ClaimFlow SHALL reset the paying state so the user can attempt a new claim.
5. WHEN the `claimCoin` function receives a non-conflict error from Supabase, THE Store SHALL return a generic error indication so the ClaimFlow can display an appropriate message.

### Requirement 11: Minimum Purchase Size (10 Coin Spots)

**User Story:** As a user, I want to select multiple coin spots on the heart before checking out, so that I can claim at least 10 spots at ₦100 each (₦1000 minimum) in a single purchase.

#### Acceptance Criteria

1. WHEN a user opens the ClaimFlow, THE LoveCoin_App SHALL allow the user to select multiple coin spots on the HeartGrid before proceeding to checkout.
2. THE minimum number of coin spots a user can purchase in a single checkout SHALL be 10, totaling ₦1000 at ₦100 per spot.
3. WHEN a user has selected fewer than 10 coin spots and attempts to proceed to checkout, THE ClaimFlow SHALL display a message indicating the minimum purchase is 10 spots (₦1000) and SHALL NOT allow checkout to proceed.
4. WHEN a user has selected 10 or more coin spots, THE ClaimFlow SHALL display the total amount (number of spots × ₦100) and SHALL allow the user to proceed to checkout.
5. THE ClaimFlow SHALL allow the user to personalize each selected coin spot individually (name, message, photo, style) before checkout, or SHALL allow the user to apply a single personalization to all spots if they prefer.
6. WHEN a user has selected more than 10 spots, THE ClaimFlow SHALL display each spot's coin number and SHALL allow the user to remove individual spots from the selection before checkout, but SHALL enforce the 10-spot minimum at checkout time.

### Requirement 12: Purchase Order Tracking

**User Story:** As a developer, I want to track purchase orders in the database, so that I can correlate Bachs checkout sessions and webhook events with the specific coin spots a user intends to claim.

#### Acceptance Criteria

1. THE LoveCoin_App SHALL create a `purchase_orders` table in the Supabase database with the following columns: `id` (uuid primary key), `user_id` (uuid, FK to auth.users), `payment_reference` (text, unique), `coin_numbers` (integer array, the selected coin numbers), `total_amount_kobo` (integer, total in smallest currency unit), `status` (text: "pending", "succeeded", "failed", "cancelled"), `bachs_checkout_id` (text, nullable), `bachs_charge_id` (text, nullable), `created_at` (timestamptz), `updated_at` (timestamptz).
2. WHEN a user initiates checkout, THE LoveCoin_App SHALL insert a Purchase_Order row with status "pending" via the Supabase_Client (RLS-enforced so `user_id = auth.uid()`) BEFORE creating the Bachs checkout session.
3. WHEN the Bachs checkout session is created by the Supabase Edge Function, THE Edge Function SHALL update the Purchase_Order's `bachs_checkout_id` field using the service-role client.
4. WHEN the Bachs webhook confirms a successful `collection.succeeded` event, THE Supabase Edge Function SHALL update the Purchase_Order status to "succeeded" and SHALL insert the LoveCoin records for each coin number in the `coin_numbers` array, inside a single atomic transaction.
5. WHEN the Bachs webhook reports a `collection.failed` event, THE Supabase Edge Function SHALL update the Purchase_Order status to "failed".
6. WHEN a user cancels the checkout (redirects to the cancel URL), THE LoveCoin_App SHALL update the Purchase_Order status to "cancelled" (client-side update permitted by RLS only when current status is "pending").
7. THE `purchase_orders` table SHALL have RLS policies allowing authenticated users to `SELECT` rows where `user_id = auth.uid()`, `INSERT` rows where `user_id = auth.uid() AND status = 'pending'`, and `UPDATE` the status to "cancelled" only where `user_id = auth.uid() AND status = 'pending'`. The service role SHALL bypass RLS for webhook processing. Users SHALL NOT be able to set status to "succeeded" or "failed" from the client.
8. THE `payment_reference` column SHALL be unique, ensuring that duplicate webhook deliveries for the same reference do not result in duplicate coin claims.
9. THE Supabase Edge Function SHALL verify, before inserting coins, that the Purchase_Order's `user_id` matches the user who signed the checkout session by comparing the Bachs checkout session's customer email to the auth user's email, preventing a malicious user from creating a purchase order with another user's `user_id`.

### Requirement 13: Idempotent Coin Claiming

**User Story:** As a user, I want the coin claiming process to be idempotent, so that if a network retry or webhook redelivery occurs, I am never charged twice or given duplicate coins.

#### Acceptance Criteria

1. WHEN the Bachs checkout session creation is retried with the same `Idempotency-Key` (payment reference), THE Bachs API SHALL return the same checkout session rather than creating a duplicate.
2. WHEN a webhook event is received by the Supabase Edge Function for a payment reference whose Purchase_Order is already in "succeeded" status, THE Edge Function SHALL return HTTP 200 without inserting duplicate LoveCoin records.
3. WHEN a webhook event is received for a payment reference whose Purchase_Order is already in "failed" status, THE Edge Function SHALL return HTTP 200 without re-processing.
4. WHEN a coin number in the Purchase_Order's `coin_numbers` array was already claimed by another user before the webhook processes the payment, THE Edge Function SHALL log the conflict, refund the user for the conflicting spot(s) via the Bachs refund API, and SHALL insert LoveCoin records only for the non-conflicting spots, all within the same transaction.
5. THE LoveCoin_App SHALL never allow the Supabase_Client (browser) to insert LoveCoin records directly. All LoveCoin insertion SHALL occur exclusively inside the Supabase Edge Function after webhook-verified payment, enforced by an RLS policy on `lovecoins` that rejects client-side `INSERT` of claimed coins (the `claim own coin` policy SHALL be replaced with a policy that only the service role can insert claimed coins).
6. THE LoveCoin_App SHALL never rely on the checkout redirect URL alone to insert coin records; coin insertion SHALL only occur after webhook-confirmed payment processed by the Edge Function, preventing a user from receiving coins by manipulating the redirect.

### Requirement 14: OAuth Redirect Handling

**User Story:** As a user signing in with Google, I want to be redirected back to the page I was on after authentication completes, so that the sign-in flow feels seamless.

#### Acceptance Criteria

1. WHEN a user initiates Google OAuth sign-in, THE LoveCoin_App SHALL pass the current page URL or a designated redirect target as the `redirectTo` parameter to Supabase OAuth.
2. WHEN the OAuth provider redirects back to the LoveCoin_App after successful authentication, THE LoveCoin_App SHALL parse the access token and session from the URL hash or query parameters.
3. WHEN the OAuth redirect includes an error parameter, THE LoveCoin_App SHALL display an error message on the auth page.
4. WHEN the OAuth redirect succeeds and the user was previously on a specific page (e.g., explore, coin detail), THE LoveCoin_App SHALL navigate the user back to that page.
5. WHEN the OAuth redirect succeeds and no previous page context exists, THE LoveCoin_App SHALL navigate the user to the My LoveCoins page.

### Requirement 15: Received Coins Concept

**User Story:** As a user, I want to see LoveCoins that were created for me by other people, so that I can view love I've received in one place.

#### Acceptance Criteria

1. WHEN a user views the My LoveCoins page, THE LoveCoin_App SHALL display a "Coins I've received" section showing LoveCoins where the current user is the recipient.
2. THE Supabase_Client SHALL query LoveCoins where the `owner_id` is not the current user and the coin is linked to the current user as recipient.
3. WHEN a LoveCoin is created with the current user's authenticated user ID as the recipient, THE LoveCoin_App SHALL include that coin in the "Coins I've received" section.
4. WHEN no LoveCoins have been received by the current user, THE LoveCoin_App SHALL display an empty state message in the "Coins I've received" section.
5. THE "Coins I've received" section SHALL NOT include coins created by the current user.

### Requirement 16: TypeScript Database Type Generation

**User Story:** As a developer, I want the TypeScript types in the codebase to stay in sync with the Supabase database schema, so that type errors are caught at compile time instead of runtime.

#### Acceptance Criteria

1. THE LoveCoin_App SHALL use the Supabase CLI to generate TypeScript database types from the live database schema.
2. WHEN the database schema is modified, THE LoveCoin_App SHALL regenerate the TypeScript types in `src/integrations/supabase/types.ts` to reflect the current schema.
3. THE generated TypeScript types SHALL include Row, Insert, and Update types for all tables: `profiles`, `lovecoins`, `lovenotes`, and `reactions`.
4. THE generated TypeScript types SHALL include relationship metadata for foreign key constraints between tables.
5. THE Store SHALL use the generated Database type as the generic parameter when creating the Supabase client, so that all queries are type-checked at compile time.

### Requirement 17: Store Data Loading Optimization

**User Story:** As a user, I want the app to load data efficiently, so that pages render quickly even as the number of LoveCoins and LoveNotes grows.

#### Acceptance Criteria

1. WHEN the Store loads LoveCoins from Supabase, THE Supabase_Client SHALL select only the columns needed for rendering and SHALL NOT select unnecessary columns.
2. WHEN the Store loads LoveNotes from Supabase, THE Supabase_Client SHALL order by `created_at` descending and SHALL limit results to the most recent 100 notes.
3. WHEN the Store loads reactions from Supabase, THE Supabase_Client SHALL select only `love_note_id`, `user_id`, and `reaction_type` columns.
4. WHEN the Love of Fame page needs more notes than the initial load, THE LoveCoin_App SHALL implement pagination or infinite scroll to load additional notes.
5. WHEN the HeartGrid needs to render claimed coins, THE Supabase_Client SHALL return only coin numbers and styles, not full message content, to reduce payload size.

### Requirement 18: Error Handling and Resilience

**User Story:** As a user, I want the app to handle Supabase connection errors gracefully, so that I see helpful messages instead of blank screens or silent failures.

#### Acceptance Criteria

1. WHEN a Supabase query fails during initial data loading, THE Store SHALL set the `ready` flag to true and display an error state rather than hanging indefinitely.
2. WHEN a Supabase mutation fails (claimCoin, publishNote, toggleReaction), THE Store SHALL return a failure indication and the calling component SHALL display an error message to the user.
3. WHEN the Supabase real-time subscription disconnects, THE Store SHALL attempt to reconnect automatically.
4. WHEN the Supabase real-time subscription fails after 3 reconnection attempts, THE Store SHALL fall back to manual refresh mode and SHALL display a subtle indicator that real-time updates are unavailable.
5. WHEN a user's auth session expires, THE LoveCoin_App SHALL redirect the user to the auth page with a message indicating the session has expired.

### Requirement 19: Storage RLS Policies

**User Story:** As a developer, I want storage bucket policies to enforce access control, so that users can only upload files to their own paths and cannot delete other users' images.

#### Acceptance Criteria

1. THE `coin-photos` bucket SHALL have an RLS policy allowing authenticated users to upload files only to a path prefixed with their own user ID.
2. THE `note-photos` bucket SHALL have an RLS policy allowing authenticated users to upload files only to a path prefixed with their own user ID.
3. THE `coin-photos` and `note-photos` buckets SHALL have a public read policy allowing anonymous access to all files via their public URLs.
4. THE `coin-photos` and `note-photos` buckets SHALL have a delete policy allowing users to delete only files in their own user-prefixed paths.
5. THE Supabase_Admin_Client SHALL be able to bypass all storage RLS policies for administrative operations.

### Requirement 20: Auth State Synchronization

**User Story:** As a user, I want my authentication state to stay synchronized across browser tabs, so that signing in or out in one tab updates all open tabs.

#### Acceptance Criteria

1. WHEN a user signs in or signs out in one browser tab, THE Supabase_Client SHALL broadcast the auth state change to all other open tabs of the LoveCoin_App.
2. WHEN an auth state change is received from another tab, THE Store SHALL update the `currentUser` and session state accordingly.
3. WHEN a user's session is refreshed by the Supabase_Client, THE Store SHALL update the access token without disrupting the user's current page or data.
4. WHEN the auth state changes from authenticated to unauthenticated, THE LoveCoin_App SHALL redirect the user away from authenticated-only pages to the auth page.
5. WHEN the auth state changes from unauthenticated to authenticated, THE LoveCoin_App SHALL load the user's data (coins, notes, reactions) without requiring a full page reload.

### Requirement 21: Supabase-Native Security Architecture

**User Story:** As a developer, I want the entire backend security model to be enforced by Supabase (RLS, Edge Functions, service-role isolation) so that no privileged operation is reachable from the browser, no client can escalate privileges by crafting direct API calls, and no coin can be granted without a verified payment.

#### Acceptance Criteria

1. THE LoveCoin_App SHALL enforce all data access authorization via Supabase Row-Level Security (RLS) policies on every table in the `public` schema, and SHALL NOT rely on client-side UI gating as the sole access control mechanism.
2. THE Supabase_Client (browser) SHALL never use the service-role key. The `SUPABASE_SERVICE_ROLE_KEY` SHALL only be loaded inside Supabase Edge Functions and server-only modules, and SHALL NEVER be exposed to the client bundle or reachable from client-side code paths.
3. WHEN the client inserts a LoveCoin row, THE `lovecoins` RLS policy SHALL reject any insert where `owner_id` is not `auth.uid()`, so a user cannot claim coins on behalf of another user or create coins without authentication.
4. WHEN a user attempts to read a private LoveCoin, THE `lovecoins` RLS policy SHALL return the row only when `owner_id = auth.uid()`.
5. THE coin claiming flow SHALL be split into two phases that cannot be bypassed by the client: (a) the client creates a `purchase_orders` row with status "pending" via the Supabase_Client (RLS-enforced to the user's own id), and (b) a Supabase Edge Function verifies the Bachs webhook, then inserts the LoveCoin rows using the service-role client. The browser SHALL NOT be able to insert LoveCoin rows directly from the "pending" state without the verified webhook.
6. THE Supabase Edge Function that processes Bachs webhooks SHALL verify the `X-Bachs-Signature` header before any database write, SHALL look up the Purchase_Order by `payment_reference`, and SHALL only insert coins when the order is in "pending" status, transitioning it to "succeeded" in a single database transaction.
7. THE webhook Edge Function SHALL perform coin insertion and Purchase_Order status update as a single atomic transaction, so that partial failures never leave coins unclaimed-but-paid or claimed-but-unpaid.
8. WHEN a coin number conflict occurs inside the webhook transaction (another webhook processed the same number first), THE Edge Function SHALL mark the conflicting spot for refund and SHALL insert only the non-conflicting coins, keeping the Purchase_Order transactional.
9. THE `purchase_orders` table SHALL have RLS policies allowing authenticated users to `SELECT` only their own rows, `INSERT` rows only where `user_id = auth.uid()`, and `UPDATE` only rows where `user_id = auth.uid() AND status = 'pending'` (to cancel). The service role SHALL bypass RLS for webhook processing. Users SHALL NOT be able to set status to "succeeded" from the client.
10. THE `reactions` table RLS policy SHALL reject any insert or delete where `user_id != auth.uid()`, so a user cannot forge reactions on behalf of another user.
11. THE `lovenotes` table RLS policy SHALL reject any insert where `user_id != auth.uid()`, and any update or delete where `user_id != auth.uid()`, so a user cannot publish or edit notes under another user's name.
12. THE `profiles` table RLS policy SHALL reject any `UPDATE` where `id != auth.uid()`, so a user cannot rename another user's profile.
13. THE Supabase Storage buckets (`coin-photos`, `note-photos`) SHALL enforce via RLS that an authenticated user can only upload objects under a path prefixed by their own `auth.uid()`, and SHALL reject uploads to another user's path.
14. THE LoveCoin_App SHALL enable Supabase Auth MFA (multi-factor authentication) requirement for any user account that performs purchases, OR SHALL document the threat model and explicitly accept the risk for the MVP, so that account takeover cannot trivially lead to purchased-coin theft.
15. THE LoveCoin_App SHALL enable email confirmation on new Supabase Auth signups, so that an unverified email address cannot create purchase orders or claim coins.
16. THE LoveCoin_App SHALL restrict the Supabase project's allowed redirect URLs for OAuth to the production domain and explicit preview domains, so that stolen OAuth codes cannot be redirected to an attacker-controlled host.
17. WHEN the Supabase real-time subscription is active, THE real-time policies SHALL respect RLS, so that a user does not receive `INSERT` events for private LoveCoins owned by other users.
18. THE LoveCoin_App SHALL NOT store the Bachs secret API key or webhook signing secret in any client-reachable environment variable (no `VITE_` prefix). These secrets SHALL be stored as Supabase Edge Function secrets or server-only environment variables only.
19. THE LoveCoin_App SHALL set the Bachs webhook endpoint URL in the Bachs dashboard to the Supabase Edge Function URL, and SHALL NOT expose any other endpoint that mutates coin state.
20. WHEN a user's session token expires or is revoked, all subsequent Supabase queries from the client SHALL fail with a 401 and the LoveCoin_App SHALL redirect to the auth page; no cached data SHALL remain mutable after session expiry.

### Requirement 22: Redux Toolkit and RTK Query for Data Layer

**User Story:** As a developer, I want all API interactions, data persistence, caching, and real-time synchronization to flow through Redux Toolkit (RTK) and RTK Query, so that data fetching is centralized, cached, type-safe, and consistent across the app instead of scattered raw `fetch` calls.

#### Acceptance Criteria

1. THE LoveCoin_App SHALL use Redux Toolkit (RTK) and RTK Query for all asynchronous server state, data fetching, caching, mutations, and real-time data synchronization.
2. THE LoveCoin_App SHALL NOT use raw `fetch` directly in components, hooks, or services. All network data flow SHALL go through RTK Query endpoints.
3. THE Supabase JS client SHALL be wrapped inside RTK Query `queryFn` / `mutationFn` handlers, so that Supabase calls are cached, invalidated, and tracked by RTK Query rather than called ad-hoc in components.
4. THE LoveCoin_App SHALL define one RTK Query API slice per feature (`coinsApi`, `paymentsApi`, `fameApi`, `sharingApi`, `authApi`), each with clearly named endpoints, rather than a single monolithic API slice.
5. THE LoveCoin_App SHALL configure a single Redux store (`configureStore`) with all API slices and feature slices combined, and SHALL wrap the app in a `<Provider>` at the root level.
6. THE LoveCoin_App SHALL use RTK Query tag types for cache invalidation, so that a successful mutation (e.g., claiming a coin, publishing a note, toggling a reaction) invalidates the relevant cached queries and triggers a refetch.
7. THE LoveCoin_App SHALL use RTK Query's built-in `isLoading`, `isError`, `isSuccess`, and `error` states to render loading, error, empty, and success UI states, rather than manually tracking fetch state in component state.
8. THE LoveCoin_App SHALL use RTK slices (not RTK Query) only for cross-component UI state that needs to be shared (e.g., coin selection across the HeartGrid and ClaimFlow), and SHALL keep temporary form state local to the component that owns it.
9. WHEN a Supabase real-time event is received, THE LoveCoin_App SHALL dispatch an RTK Query `updateQueryData` or `invalidateTags` action so that the cache is updated optimistically or refetched, rather than maintaining a separate parallel state store.
10. THE LoveCoin_App SHALL define a shared `baseQuery` that injects the Supabase auth token into requests and handles 401 responses by redirecting to the auth page, so that auth session expiry is handled consistently across all features.
11. THE LoveCoin_App SHALL remove the existing `LoveProvider` context-based store (`src/lib/store.tsx`) and migrate its responsibilities into RTK Query API slices and RTK slices, so that there is a single source of truth for server state and cross-component UI state.
12. THE LoveCoin_App SHALL keep each RTK Query API slice and RTK slice in its own file under the corresponding feature folder (`features/{feature}/api/{feature}Api.ts`, `features/{feature}/slices/{feature}Slice.ts`), so that files stay readable and focused per the code guide.
13. THE LoveCoin_App SHALL NOT introduce Redux for local component state that does not need to be shared. Forms, modals, and ephemeral UI state SHALL remain in component-level `useState` or the project's existing form library.