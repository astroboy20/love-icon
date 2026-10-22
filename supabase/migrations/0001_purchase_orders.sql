-- Migration: purchase_orders table
-- Implements the server-side purchase order tracking required for the two-phase coin claim flow.
-- A purchase_order is created by the client (status=pending) before a Bachs checkout session is
-- created. The Edge Function updates it to succeeded/failed after webhook verification.
-- Only the service role (Edge Functions) can transition orders to terminal states.

-- =============================================================================
-- Table: purchase_orders
-- =============================================================================

create table public.purchase_orders (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  payment_reference   text        not null unique,
  coin_numbers        integer[]   not null,
  total_amount_kobo   integer     not null,
  status              text        not null default 'pending'
                                  check (status in ('pending', 'succeeded', 'failed', 'cancelled')),
  bachs_checkout_id   text,
  bachs_charge_id     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

create index purchase_orders_user_id_idx
  on public.purchase_orders (user_id);

create index purchase_orders_status_idx
  on public.purchase_orders (status);

-- payment_reference already has a unique index from the unique constraint above,
-- but a named index makes it explicit for the webhook lookup path.
create index purchase_orders_payment_reference_idx
  on public.purchase_orders (payment_reference);

-- =============================================================================
-- Grants
-- =============================================================================

grant select, insert, update on public.purchase_orders to authenticated;
grant all                     on public.purchase_orders to service_role;

-- =============================================================================
-- Row-Level Security
-- =============================================================================

alter table public.purchase_orders enable row level security;

-- Authenticated users can read their own orders (for status polling after redirect).
create policy "own orders read"
  on public.purchase_orders
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can insert a pending order for themselves only.
-- status is constrained to 'pending' here; the check constraint on the column
-- already rejects any other value, but the RLS policy makes the intent explicit.
create policy "own order insert pending"
  on public.purchase_orders
  for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending');

-- Authenticated users can cancel their own pending orders.
-- using() ensures the row currently has status='pending' before the update.
-- with check() ensures the update can only set status to 'cancelled'.
-- Users cannot set status to 'succeeded' or 'failed' from the client.
create policy "own order cancel"
  on public.purchase_orders
  for update
  to authenticated
  using  (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'cancelled');

-- =============================================================================
-- Auto-update updated_at trigger
-- =============================================================================

create or replace function public.update_purchase_order_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger purchase_order_updated_at
  before update on public.purchase_orders
  for each row
  execute function public.update_purchase_order_timestamp();
