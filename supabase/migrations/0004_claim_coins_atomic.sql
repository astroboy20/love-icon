-- Migration: atomic coin claim function
--
-- Creates a Postgres function `claim_coins_atomic` that the bachs-webhook Edge
-- Function calls via supabase.rpc(). Running the inserts and order-status update
-- inside a single function body means they execute in the same transaction: if
-- anything fails mid-way Postgres rolls the whole thing back automatically,
-- preventing the partial-fulfillment state where some coins are inserted but
-- the order is never marked succeeded (or vice-versa).
--
-- The function is defined as SECURITY DEFINER so it runs with the privileges
-- of the owning role (postgres / service_role) regardless of the caller. This
-- lets the Edge Function's service-role client call it without bypassing the
-- function's own internal logic.
--
-- Parameters:
--   p_order_id       uuid      — the purchase_order primary key
--   p_charge_id      text      — Bachs charge ID to store on the order row
--   p_coin_payloads  jsonb     — array of coin objects to insert, each with:
--                                  coin_number, owner_id, creator_name,
--                                  recipient_name, relation, message, style,
--                                  visibility, status
--
-- Returns: jsonb with shape
--   {
--     "inserted":    [<coin_numbers that were inserted>],
--     "conflicting": [<coin_numbers that already existed>]
--   }
--
-- The caller (Edge Function) uses the "conflicting" list to issue Bachs refunds
-- outside the transaction, after it returns.

create or replace function public.claim_coins_atomic(
  p_order_id      uuid,
  p_charge_id     text,
  p_coin_payloads jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload       jsonb;
  v_coin_number   integer;
  v_inserted      integer[] := '{}';
  v_conflicting   integer[] := '{}';
begin
  -- Insert each coin; catch unique-constraint violations (code 23505) on
  -- coin_number and collect them as conflicts rather than aborting the whole
  -- transaction.
  for v_payload in select * from jsonb_array_elements(p_coin_payloads)
  loop
    v_coin_number := (v_payload->>'coin_number')::integer;

    begin
      insert into public.lovecoins (
        coin_number,
        owner_id,
        creator_name,
        recipient_name,
        relation,
        message,
        style,
        visibility,
        status
      ) values (
        v_coin_number,
        (v_payload->>'owner_id')::uuid,
        v_payload->>'creator_name',
        v_payload->>'recipient_name',
        v_payload->>'relation',
        v_payload->>'message',
        v_payload->>'style',
        v_payload->>'visibility',
        v_payload->>'status'
      );

      v_inserted := v_inserted || v_coin_number;

    exception
      when unique_violation then
        -- coin_number already claimed — record for refund, continue
        v_conflicting := v_conflicting || v_coin_number;
    end;
  end loop;

  -- Update the purchase order to succeeded in the same transaction.
  -- Using a plain UPDATE (no RLS — function runs as security definer /
  -- service role which bypasses RLS).
  update public.purchase_orders
  set
    status          = 'succeeded',
    bachs_charge_id = p_charge_id,
    updated_at      = now()
  where id = p_order_id;

  return jsonb_build_object(
    'inserted',    to_jsonb(v_inserted),
    'conflicting', to_jsonb(v_conflicting)
  );
end;
$$;

-- Only the service role should be able to call this function directly.
-- Authenticated (browser) users cannot call it.
revoke execute on function public.claim_coins_atomic(uuid, text, jsonb) from public, authenticated;
grant  execute on function public.claim_coins_atomic(uuid, text, jsonb) to service_role;
