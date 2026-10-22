-- Migration: enforce two-phase coin claim flow via RLS
--
-- SECURITY-CRITICAL: This migration removes the ability for browser clients to insert
-- LoveCoin records directly. After this migration, the only path to claiming a coin is:
--   1. Client inserts a purchase_order (status=pending)
--   2. Edge Function creates a Bachs checkout session
--   3. Bachs webhook fires, Edge Function verifies signature and inserts lovecoins
--      using the service-role client (which bypasses RLS entirely)
--
-- Without this change, a user could forge a coin claim by calling the Supabase client
-- directly, bypassing payment entirely.

-- =============================================================================
-- lovecoins: drop client-side INSERT policy
-- =============================================================================

-- Drop the existing insert policy that allowed any authenticated user to insert
-- a lovecoin where owner_id = auth.uid(). From this point forward, no INSERT
-- policy exists for authenticated users on lovecoins. The service role bypasses
-- RLS and remains the only entity that can insert coin records (via Edge Functions
-- after webhook-confirmed payment).
drop policy if exists "claim own coin" on public.lovecoins;

-- Verify the SELECT policy: private coins must only be visible to their owner.
-- The existing "public coins readable" policy on lovecoins already reads:
--   using (visibility = 'public' or owner_id = auth.uid())
-- This is correct — private coins are filtered server-side. No change needed.

-- =============================================================================
-- lovenotes: verify existing RLS policies (no changes needed)
-- =============================================================================

-- The following policies were created in migration 0000 and satisfy Req 21.11:
--   "write own note"  — insert: auth.uid() = user_id
--   "update own note" — update: auth.uid() = user_id
--   "delete own note" — delete: auth.uid() = user_id
-- No additional changes required for lovenotes.

-- =============================================================================
-- Confirm all public schema tables have RLS enabled (Req 21.1)
-- =============================================================================

-- The following tables all had RLS enabled in migration 0000:
--   public.profiles    — enabled
--   public.lovecoins   — enabled
--   public.lovenotes   — enabled
--   public.reactions   — enabled
-- Migration 0001 enabled RLS on public.purchase_orders.
-- All public schema tables are covered.

-- No additional DDL is required for this migration beyond the policy drop above.
-- The security guarantee is enforced by the absence of an INSERT policy for
-- authenticated users on public.lovecoins.
