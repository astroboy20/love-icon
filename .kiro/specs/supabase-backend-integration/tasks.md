# Implementation Plan: Supabase Backend Integration

## Overview

This plan implements the full Supabase backend integration for LoveCoin, replacing the `LoveProvider` context store and mock payment flow with Redux Toolkit + RTK Query, Bachs hosted checkout via Edge Functions, Supabase Storage for images, real-time subscriptions, and a secure two-phase coin claim flow. Tasks follow the 12-step refactoring migration plan from the design document so the app never breaks at any step.

## Tasks

- [x] 1. Add dependencies and project configuration
  - Install `@reduxjs/toolkit`, `react-redux`, and `fast-check` in `package.json`
  - Add `vitest` if not already configured (check for existing test config)
  - Create `.env.example` with placeholder values for client-side (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) and server-side (`BACHS_API_KEY`, `BACHS_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `BACHS_RETURN_URL`, `BACHS_CANCEL_URL`, `BACHS_BASE_URL`) variables
  - _Requirements: 22.1, 21.18_

- [x] 2. Set up Redux store and Provider
  - [x] 2.1 Create `src/app/store.ts` with `configureStore`, combining all API slice reducers and feature slice reducers
    - Wire `authApi`, `coinsApi`, `fameApi`, `paymentsApi`, `sharingApi` reducers
    - Wire `coinsSlice`, `authSlice` reducers
    - Set up RTK Query middleware for all API slices
    - _Requirements: 22.5, 22.12_

  - [x] 2.2 Create `src/app/provider.tsx` with the Redux `<Provider>` component wrapping the app
    - Export a `StoreProvider` component that wraps children with the Redux store
    - _Requirements: 22.5_

  - [x] 2.3 Create shared `src/lib/api/supabaseBaseQuery.ts` for RTK Query
    - Implement a `supabaseBaseQuery` that wraps Supabase JS client calls in `queryFn` handlers
    - Inject the Supabase auth token into requests
    - Intercept 401 / `PGRST301` errors: dispatch `markSessionExpired()` and redirect to `/auth?reason=expired`
    - _Requirements: 22.3, 22.10, 18.5, 21.20_

  - [x] 2.4 Create `src/lib/config/app.ts` with app configuration
    - Define bucket names (`coin-photos`, `note-photos`), Bachs return/cancel URLs, Edge Function URLs
    - _Requirements: 1.1, 4.1_

- [x] 3. Create RTK Query API slices and RTK UI slices
  - [x] 3.1 Create `src/features/auth/api/authApi.ts`
    - Endpoints: `getSession` (query), `getProfile` (query by userId), `updateDisplayName` (mutation), `signInWithGoogle` (mutation with redirectTo), `signInWithEmail` (mutation), `signUpWithEmail` (mutation), `signOut` (mutation)
    - Tag types: `"Profile"`, `"Session"`
    - `updateDisplayName` invalidates `"Profile"` tag
    - _Requirements: 6.2, 6.3, 14.1, 22.4, 22.6_

  - [x] 3.2 Create `src/features/coins/api/coinsApi.ts`
    - Endpoints: `getCoins` (query, selects only `coin_number`, `style`, `owner_id` for HeartGrid), `getCoinByNumber` (query), `getMyCoins` (query), `getReceivedCoins` (query where `owner_id != current user` and recipient matches current user), `uploadCoinPhoto` (mutation: uploads to `coin-photos` bucket, returns public URL)
    - Tag types: `"Coins"`, `"Coin"`, `"MyCoins"`, `"ReceivedCoins"`
    - `uploadCoinPhoto` generates path `{userId}/{timestamp}-{random}.{ext}`
    - _Requirements: 2.1, 2.2, 2.5, 15.2, 15.3, 17.1, 17.5, 22.4_

  - [x] 3.3 Create `src/features/payments/api/paymentsApi.ts`
    - Endpoints: `createPurchaseOrder` (mutation: inserts pending order via Supabase client), `createBachsCheckout` (mutation: invokes `create-bachs-checkout` Edge Function), `getOrderStatus` (query: polls order by orderId), `cancelPurchaseOrder` (mutation: updates status to "cancelled")
    - Tag types: `"PurchaseOrder"`
    - `createPurchaseOrder` and `cancelPurchaseOrder` invalidate `"PurchaseOrder"` tag
    - _Requirements: 4.1, 4.3, 4.4, 11.2, 12.2, 12.6, 22.4_

  - [x] 3.4 Create `src/features/fame/api/fameApi.ts`
    - Endpoints: `getNotes` (query: orders by `created_at` desc, limits to 100, supports pagination via `limit`/`offset` params), `getReactions` (query: selects only `love_note_id`, `user_id`, `reaction_type`), `publishNote` (mutation), `toggleReaction` (mutation), `uploadNotePhoto` (mutation: uploads to `note-photos` bucket)
    - Tag types: `"Notes"`, `"Reactions"`
    - `publishNote` invalidates `"Notes"`, `toggleReaction` invalidates `"Reactions"`
    - _Requirements: 3.1, 3.2, 3.5, 17.2, 17.3, 17.4, 22.4, 22.6_

  - [x] 3.5 Create `src/features/sharing/api/sharingApi.ts`
    - Endpoints: `getShareableCoin` (query by coin number), `createShareLink` (mutation)
    - Tag types: `"Coin"`
    - _Requirements: 22.4_

  - [x] 3.6 Create `src/features/coins/slices/coinsSlice.ts`
    - State: `selectedCoinNumbers: number[]`, `isClaimFlowOpen: boolean`
    - Actions: `toggleCoinSelection`, `clearSelection`, `openClaimFlow`, `closeClaimFlow`
    - _Requirements: 11.1, 11.6, 22.8, 22.13_

  - [x] 3.7 Create `src/features/auth/slices/authSlice.ts`
    - State: `currentUser: { id, displayName, email } | null`, `sessionExpired: boolean`
    - Actions: `setCurrentUser`, `clearSession`, `markSessionExpired`
    - _Requirements: 6.3, 20.2, 22.8_

- [x] 4. Create payment utility functions
  - [x] 4.1 Create `src/features/payments/utils/kobo.ts`
    - `nairaToKobo(naira: number): number` — multiply by 100 (integer arithmetic, no floating point)
    - `koboToNairaString(kobo: number): string` — divide by 100, return decimal string (e.g., `koboToNairaString(100000)` → `"1000.00"`)
    - `koboToNaira(kobo: number): number` — divide by 100 as integer
    - _Requirements: 4.1, 11.2_

  - [x] 4.2 Write property test for naira-to-kobo conversion
    - **Property 7: Naira-to-kobo conversion is exact**
    - **Validates: Requirements 4.1, 11.2**

  - [x] 4.3 Create `src/features/payments/utils/paymentReference.ts`
    - `generatePaymentReference(userId: string, timestamp: number): string` — format `lovecoin-{userId}-{timestamp}`
    - _Requirements: 4.8, 12.8, 13.1_

  - [x] 4.4 Write property test for payment reference uniqueness
    - **Property 1: Payment reference uniqueness**
    - **Validates: Requirements 4.8, 12.8, 13.1**

  - [x] 4.5 Create `src/features/payments/utils/bachsConfig.ts`
    - Export Edge Function URL, return URL, cancel URL, Bachs API base URL
    - Read from environment variables (never `VITE_` prefixed for secrets)
    - _Requirements: 4.1, 21.18_

- [x] 5. Create coin utility functions
  - [x] 5.1 Create `src/features/coins/utils/coinValidation.ts`
    - `MIN_SPOTS = 10`, `COIN_PRICE_KOBO = 10000` (₦100 in kobo)
    - `validateMinSpots(count: number): boolean` — returns true if count >= 10
    - `calculateTotalKobo(spotCount: number): number` — `spotCount * COIN_PRICE_KOBO`
    - `isCoinNumberConflictError(error: unknown): boolean` — checks `PostgresError.code === '23505'` on `coin_number`
    - _Requirements: 10.1, 10.5, 11.2, 11.3, 11.4_

  - [x] 5.2 Write property test for minimum purchase size
    - **Property 5: Minimum purchase size is enforced**
    - **Validates: Requirements 11.2, 11.3, 11.4**

  - [x] 5.3 Create `src/features/coins/utils/generateStoragePath.ts`
    - `generateStoragePath(userId: string, filename: string): string` — format `{userId}/{timestamp}-{randomId}.{ext}`
    - _Requirements: 2.5, 3.5, 19.1, 19.2_

  - [x] 5.4 Write property test for user-prefixed storage paths
    - **Property 6: Storage paths are user-prefixed**
    - **Validates: Requirements 2.5, 3.5, 19.1, 19.2, 21.13_

- [x] 6. Checkpoint - Ensure all utility functions and API slices compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Wire Redux Provider in root layout
  - [x] 7.1 Replace `QueryClientProvider` + `LoveProvider` with Redux `<StoreProvider>` in `src/routes/__root.tsx`
    - Remove `QueryClientProvider` and `LoveProvider` imports and wrapping
    - Wrap `<Layout>` with `<StoreProvider>` from `src/app/provider.tsx`
    - Keep `<Outlet />` inside `<Layout>`
    - _Requirements: 22.5, 22.11_

  - [x] 7.2 Initialize auth state in `authSlice` from Supabase session on app load
    - Call `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange()` in a root-level hook
    - Dispatch `setCurrentUser` / `clearSession` on auth state changes
    - Handle cross-tab auth sync via Supabase's built-in broadcast
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [-] 8. Migrate components to RTK Query (one at a time)
  - [x] 8.1 Refactor `ClaimFlow` to `src/features/coins/components/ClaimFlow.tsx`
    - Replace `useLove()` with `useAppSelector` + `coinsApi` hooks + `coinsSlice` actions
    - Support multi-spot selection (10+ spots minimum) with per-spot personalization
    - Replace `chargeCard` mock with `paymentsApi.createPurchaseOrder` + `paymentsApi.createBachsCheckout`
    - Upload photos via `coinsApi.uploadCoinPhoto` before creating the purchase order
    - Handle coin number conflict: detect `23505` error, display "pick another spot" message, reset paying state
    - Display total amount (spots × ₦100), enforce 10-spot minimum before checkout
    - Show "confirming your payment" state after Bachs redirect, poll `paymentsApi.getOrderStatus`
    - _Requirements: 2.1, 2.2, 2.3, 4.3, 4.4, 4.5, 4.6, 4.8, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 22.7, 22.11_

  - [x] 8.2 Create `src/features/coins/components/CoinPhotoUploader.tsx`
    - File input accepting `image/jpeg, image/png, image/webp, image/gif`
    - Client-side validation: max 5MB, MIME type check
    - Calls `coinsApi.uploadCoinPhoto` mutation, shows progress/error/preview
    - Returns the Storage public URL to parent form
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

  - [x] 8.3 Create `src/features/coins/components/CoinPersonalizationForm.tsx`
    - Extract personalization fields (name, message, photo, style) into a reusable form component
    - Support applying personalization to a single spot or to all selected spots
    - _Requirements: 11.5_

  - [x] 8.4 Create `src/features/coins/components/ReceivedCoinsSection.tsx`
    - Query `coinsApi.getReceivedCoins`, display coins where current user is recipient but not owner
    - Display empty state when no received coins exist
    - Exclude coins created by the current user
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 8.5 Create `src/features/coins/hooks/useCoinSelection.ts`
    - Hook wrapping `coinsSlice` selection state and actions
    - Provides `selectedCoinNumbers`, `toggleCoinSelection`, `clearSelection`, `isMinMet`
    - _Requirements: 11.1, 11.6, 22.8_

  - [x] 8.6 Refactor `LoveNoteComposer` to `src/features/fame/components/LoveNoteComposer.tsx`
    - Replace `useLove().publishNote` with `fameApi.publishNote` mutation
    - Upload photos via `fameApi.uploadNotePhoto` before publishing
    - Use RTK Query `isLoading`/`isError` states for UI feedback
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 18.2, 22.7, 22.11_

  - [x] 8.7 Create `src/features/fame/components/NotePhotoUploader.tsx`
    - Same pattern as `CoinPhotoUploader`, uploads to `note-photos` bucket via `fameApi.uploadNotePhoto`
    - _Requirements: 1.4, 1.5, 3.1, 3.2, 3.3_

  - [x] 8.8 Create `src/features/fame/components/ReactionButton.tsx`
    - Use `fameApi.toggleReaction` mutation, show optimistic update
    - Use `fameApi.getReactions` query for counts
    - _Requirements: 22.7, 22.11_

  - [x] 8.9 Create `src/features/auth/components/ProfileEditor.tsx`
    - Profile editing interface accessible from My LoveCoins page
    - Calls `authApi.updateDisplayName` mutation
    - Updates `authSlice.currentUser.display_name` on success without page reload
    - Display error message on failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.10 Create `src/features/payments/components/PaymentSummary.tsx`
    - Display total amount (spot count × ₦100) and selected spot count
    - _Requirements: 11.4_

  - [x] 8.11 Create `src/features/payments/components/PaymentConfirming.tsx`
    - "Confirming your payment" state after Bachs redirect
    - Polls `paymentsApi.getOrderStatus` until status transitions to "succeeded" or "failed"
    - On "succeeded": navigate to coin detail page
    - On "failed": display error, no coins claimed
    - On cancel: call `paymentsApi.cancelPurchaseOrder`, display cancelled message
    - _Requirements: 4.4, 4.5, 4.6, 12.6, 18.2_

  - [x] 8.12 Refactor route components to use RTK Query
    - `src/routes/explore.tsx`: use `coinsApi.getCoins` instead of `useLove().coins`
    - `src/routes/love-of-fame.tsx`: use `fameApi.getNotes` + `fameApi.getReactions` instead of `useLove()`
    - `src/routes/my-lovecoins.tsx`: use `coinsApi.getMyCoins` + `coinsApi.getReceivedCoins` + `authApi.getProfile` + `ProfileEditor`
    - `src/routes/coin.$coinNumber.tsx`: use `coinsApi.getCoinByNumber`
    - `src/routes/auth.tsx`: use `authApi` for sign-in/out, handle OAuth redirect (parse token from URL, navigate to previous page or My LoveCoins)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 15.1, 17.1, 17.5, 22.7, 22.11_

  - [x] 8.13 Create `src/features/sharing/components/ShareKeepsakeButton.tsx`
    - Use `sharingApi.createShareLink` and `sharingApi.getShareableCoin`
    - Web Share API with copy-link fallback
    - _Requirements: 22.4_

- [x] 9. Checkpoint - Ensure all migrated components compile and render
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Create Edge Functions
  - [x] 10.1 Create `supabase/functions/create-bachs-checkout/index.ts`
    - Verify caller JWT from `Authorization` header using Supabase client
    - Load `purchase_order` by `orderId` with service-role client, verify `user_id` matches caller and status is "pending"
    - Verify all `coinNumbers` are currently unclaimed (no `lovecoins` row with that `coin_number`)
    - Call Bachs API `POST /v1/checkouts` with: amount (kobo as decimal string), currency "NGN", customer email, reference, metadata (user_id, coin_numbers, order_id), success/cancel URLs
    - Pass `Idempotency-Key` header set to `paymentReference`
    - Update `purchase_orders.bachs_checkout_id` with returned checkout ID
    - Return `{ checkoutUrl }` to client
    - Error responses: 401 (unauthenticated), 403 (order mismatch or not pending), 409 (coin claimed), 500 (Bachs API error)
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8, 4.9, 4.10, 12.3, 21.2, 21.5_

  - [x] 10.2 Create `supabase/functions/bachs-webhook/index.ts`
    - Read exact raw request body (before JSON parsing) for signature verification
    - Verify `X-Bachs-Signature` using HMAC SHA-256 with `BACHS_WEBHOOK_SECRET`
    - Check `X-Bachs-Timestamp` is within tolerance window (300 seconds)
    - If verification fails: return HTTP 401, do not process
    - Parse event, extract `event.type`, `event.data.reference`, metadata
    - Look up `purchase_order` by `payment_reference`
    - Idempotency check: if order status is "succeeded" or "failed", return HTTP 200 without re-processing
    - If no matching order found: log discrepancy, return HTTP 200 (prevents retries)
    - For `collection.succeeded`: begin transaction, insert LoveCoin records for each coin_number (handle conflicts by marking for refund), update order status to "succeeded" with `bachs_charge_id`, commit; refund conflicting coins via Bachs refund API
    - For `collection.failed`: update order status to "failed"
    - Verify checkout session customer email matches auth user email before inserting coins
    - Return HTTP 200
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 12.4, 12.5, 12.9, 13.2, 13.3, 13.4, 13.6, 21.5, 21.6, 21.7, 21.8_

  - [ ]* 10.3 Write integration tests for create-bachs-checkout Edge Function
    - Mock Bachs API, verify checkout session creation with valid JWT
    - Reject unauthenticated requests (401)
    - Reject already-claimed coins (409)
    - Verify idempotency key is passed in header
    - _Requirements: 4.1, 4.2, 4.10, 13.1_

  - [ ]* 10.4 Write integration tests for bachs-webhook Edge Function
    - Mock webhook with valid/invalid signatures
    - Verify atomic transaction (coins inserted + order status updated together)
    - Test idempotent re-delivery (succeeded order returns 200, no duplicate coins)
    - Test `collection.failed` path
    - Test coin conflict refund path
    - _Requirements: 5.3, 5.4, 5.5, 5.7, 13.2, 13.3, 13.4_

  - [ ]* 10.5 Write property test for webhook signature verification
    - **Property 12: Webhook signature verification accepts valid and rejects invalid**
    - **Validates: Requirements 5.1, 5.2, 21.6**

  - [ ]* 10.6 Write property test for purchase order state transitions
    - **Property 2: Purchase order state transitions are valid and idempotent**
    - **Validates: Requirements 12.1, 12.4, 12.5, 12.6, 13.2, 13.3, 5.4**

  - [ ]* 10.7 Write property test for coin insertion after verified payment
    - **Property 3: Coin insertion only occurs after verified payment**
    - **Validates: Requirements 5.3, 5.8, 13.5, 13.6, 21.5**

  - [ ]* 10.8 Write property test for coin number uniqueness after insertion
    - **Property 4: Coin numbers are unique after insertion**
    - **Validates: Requirements 10.1, 13.4, 21.7**

- [ ] 11. Create database migrations
  - [ ] 11.1 Create `supabase/migrations/0001_purchase_orders.sql`
    - Create `purchase_orders` table with columns: `id`, `user_id`, `payment_reference` (unique), `coin_numbers` (integer[]), `total_amount_kobo` (integer), `status` (check: pending/succeeded/failed/cancelled), `bachs_checkout_id`, `bachs_charge_id`, `created_at`, `updated_at`
    - Create indexes on `user_id`, `status`, `payment_reference`
    - Grant `select, insert, update` to `authenticated`, `all` to `service_role`
    - Enable RLS with policies: own orders read, own order insert pending, own order cancel (update to cancelled only when status pending)
    - Create `updated_at` trigger function and trigger
    - _Requirements: 12.1, 12.2, 12.7, 12.8, 21.9_

  - [ ] 11.2 Create `supabase/migrations/0002_lovecoins_rls_change.sql`
    - Drop the existing `"claim own coin"` insert policy on `lovecoins`
    - No new INSERT policy for authenticated users (service role bypasses RLS, client inserts are rejected)
    - This is the security-critical change enforcing the two-phase claim flow
    - Verify `lovecoins` RLS SELECT policy already enforces: private coins only visible to `owner_id = auth.uid()` (Req 21.4)
    - Verify `lovenotes` RLS policies enforce: insert/update/delete only when `user_id = auth.uid()` (Req 21.11)
    - Verify all `public` schema tables have RLS enabled (Req 21.1)
    - _Requirements: 13.5, 21.1, 21.3, 21.4, 21.5, 21.11_

  - [ ] 11.3 Create `supabase/migrations/0003_storage_buckets.sql`
    - Create `coin-photos` bucket (public) and `note-photos` bucket (public)
    - Storage RLS for `coin-photos`: public read (anon + authenticated), authenticated write to own path only (`storage.foldername(name)[1] = auth.uid()`), authenticated delete own files only
    - Storage RLS for `note-photos`: same pattern as `coin-photos`
    - _Requirements: 1.1, 1.2, 1.3, 19.1, 19.2, 19.3, 19.4, 19.5, 21.13_

  - [ ]* 11.4 Write property test for RLS preventing cross-user profile updates
    - **Property 8: RLS prevents cross-user profile updates**
    - **Validates: Requirements 6.5, 21.12**

  - [ ]* 11.5 Write property test for RLS preventing cross-user reaction insertion
    - **Property 9: RLS prevents cross-user reaction insertion**
    - **Validates: Requirements 21.10**

- [ ] 12. Configure Supabase Auth security settings
  - Enable email confirmation on new Supabase Auth signups (Supabase dashboard or config)
  - Restrict allowed OAuth redirect URLs to production domain and explicit preview domains only (Supabase dashboard Auth settings)
  - Document the MFA threat model: either enable MFA requirement for purchasing users or document the explicit risk acceptance for the MVP
  - Set the Bachs webhook endpoint URL in the Bachs dashboard to the `bachs-webhook` Edge Function URL
  - _Requirements: 21.14, 21.15, 21.16, 21.19_

- [ ] 13. Regenerate Supabase TypeScript types
  - Run `npx supabase gen types typescript` after migrations are applied
  - Update `src/integrations/supabase/types.ts` with new `purchase_orders` table Row/Insert/Update types
  - Update the Supabase client creation to use `createClient<Database>(...)` for compile-time type checking
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 14. Delete old files
  - Delete `src/lib/store.tsx` (LoveProvider context store, replaced by RTK Query + RTK slices)
  - Delete `src/lib/payments.ts` (mock `chargeCard` function, replaced by Bachs Edge Function flow)
  - Remove any remaining imports of `useLove` or `chargeCard` across the codebase
  - _Requirements: 22.11_

- [ ] 15. Add real-time subscription manager
  - [ ] 15.1 Create `src/hooks/useRealtimeSync.ts`
    - Subscribe to `lovecoins` INSERT events: dispatch `coinsApi.util.updateQueryData('getCoins', ...)` with deduplication check
    - Subscribe to `lovenotes` INSERT events: dispatch `fameApi.util.updateQueryData('getNotes', ...)` with deduplication check
    - Subscribe to `reactions` INSERT and DELETE events: update reaction counts via `fameApi.util.updateQueryData`
    - Skip private coins for non-owners (RLS-enforced by Supabase real-time)
    - Clean up channels on unmount or sign-out
    - Only subscribe to reactions channel when user is on a page displaying LoveNotes
    - Reconnection strategy: exponential backoff (1s, 2s, 4s), max 3 attempts, then `setRealtimeUnavailable()`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 18.3, 18.4, 21.17, 22.9_

  - [ ]* 15.2 Write property test for real-time deduplication
    - **Property 10: Real-time deduplication**
    - **Validates: Requirements 7.5, 8.5**

  - [ ]* 15.3 Write property test for real-time private coin exclusion
    - **Property 11: Real-time private coin exclusion**
    - **Validates: Requirements 7.3, 21.17**

- [ ] 16. Wire real-time sync and OAuth redirect handling
  - [ ] 16.1 Call `useRealtimeSync()` in the root layout component
    - Mount the real-time subscription manager when user is authenticated
    - _Requirements: 7.1, 8.1, 9.1, 22.9_

  - [ ] 16.2 Implement OAuth redirect handling in `src/routes/auth.tsx`
    - Pass current page URL or designated redirect target as `redirectTo` to `supabase.auth.signInWithOAuth`
    - Parse access token and session from URL hash or query parameters after OAuth redirect
    - Display error message if OAuth redirect includes error parameter
    - Navigate to previous page if context exists, otherwise to My LoveCoins page
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 16.3 Implement session expiry redirect
    - The `supabaseBaseQuery` 401 interceptor dispatches `markSessionExpired()` and redirects to `/auth?reason=expired`
    - Clear mutable cached data after session expiry
    - _Requirements: 18.5, 20.4, 21.20_

- [ ] 17. Final checkpoint - Ensure all tests pass and app compiles
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests verify Edge Functions, storage RLS, and end-to-end payment flows with mocked Bachs API
- The 12-step migration plan ordering ensures the app never breaks at any step: dependencies → store → API slices → Provider → component migration → Edge Functions → migrations → type regen → old file deletion → real-time sync → tests
