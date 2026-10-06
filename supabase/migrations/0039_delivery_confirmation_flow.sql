-- =============================================================================
-- IslaPabili MVP v1.0 - 0039: customer-confirmed delivery (proof of receipt)
--
-- Rider-delivery flow becomes:
--   in_transit -> delivered (rider: "nadala ko na") -> completed (customer tap)
--
-- No auto-complete: the order waits in `delivered` until the customer
-- confirms. `merchant_pickup` counter handover via verify_claim_code() is
-- unchanged (ready -> completed at the counter).
--
-- What this ships:
--   1. delivered_at / delivered_reminded_at timestamps on orders.
--   2. BEFORE trigger validate_order_status_transition(): server-side guard
--      so riders cannot jump straight to completed and customers are the
--      only ones who close a delivered order. Service role / admin bypass.
--   3. on_order_status_event() patch: "nadala na, pakicheck" notification
--      on delivered + customer-confirmed copy on completed.
--   4. RLS: customer may close delivered orders; rider WITH CHECK drops
--      `completed`; chat + live-tracking windows cover `delivered`.
-- =============================================================================

-- Timestamps ----------------------------------------------------------------

alter table public.orders
  add column if not exists delivered_at timestamptz,
  add column if not exists delivered_reminded_at timestamptz;

-- Transition guard + timestamp stamping --------------------------------------

create or replace function public.validate_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role() = 'service_role', false);
  v_is_customer boolean := v_actor is not null and old.customer_id = v_actor;
  v_is_rider boolean := v_actor is not null and old.rider_id = v_actor;
  v_is_owner boolean := old.merchant_id is not null and public.is_merchant_owner(old.merchant_id);
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Service role (dispatch / edge functions) and admins bypass the matrix.
  if v_is_service or public.is_admin() then
    if new.status = 'delivered' and new.delivered_at is null then
      new.delivered_at := now();
    end if;
    if new.status = 'completed' and new.completed_at is null then
      new.completed_at := now();
    end if;
    return new;
  end if;

  -- Terminal states are final.
  if old.status in ('completed', 'cancelled', 'failed') then
    raise exception 'Order is already % and cannot move to %.', old.status, new.status;
  end if;

  -- Cancelling stays open for participants before completion.
  if new.status in ('cancelled', 'failed') then
    if v_is_customer or v_is_rider or v_is_owner then
      return new;
    end if;
    raise exception 'Only order participants can cancel this order.';
  end if;

  -- The proof-of-receipt core: only the customer closes a delivered order.
  if new.status = 'completed' then
    if v_is_customer and old.status = 'delivered' then
      new.completed_at := now();
      return new;
    end if;
    -- Counter handover: store verifies the claim code at pickup.
    if v_is_owner and old.status = 'ready' and old.merchant_id is not null then
      new.completed_at := now();
      new.claimed_at := now();
      return new;
    end if;
    raise exception 'Only the customer can confirm receipt of a delivered order.';
  end if;

  if new.status = 'delivered' then
    if v_is_rider and old.status = 'in_transit' then
      new.delivered_at := now();
      new.delivered_reminded_at := null;
      return new;
    end if;
    raise exception 'Only the assigned rider can mark an in-transit order as delivered.';
  end if;

  -- Dispatch assignment: a rider accepts an open pabili offer
  -- (respond_pabili_request / accept_pabili_order run as the rider and set
  -- rider_id to themselves; direct client writes stay blocked by RLS).
  if old.status = 'pending_dispatch' and new.status = 'rider_assigned' then
    if v_actor is not null and new.rider_id is not null and new.rider_id = v_actor then
      return new;
    end if;
    raise exception 'Only the accepting rider can claim this order.';
  end if;

  -- Rider walk-back: mistaken "delivered" tap returns to in_transit.
  if old.status = 'delivered' and new.status = 'in_transit' then
    if v_is_rider then
      return new;
    end if;
    raise exception 'Only the assigned rider can resume a delivered order.';
  end if;

  -- Rider happy path.
  if v_is_rider and (
    (old.status = 'rider_assigned' and new.status = 'items_purchased')
    or (old.status = 'items_purchased' and new.status = 'in_transit')
  ) then
    return new;
  end if;

  -- Customer pre-dispatch moves (retry pabili, cancel path companions).
  if v_is_customer and old.status in ('pending_dispatch', 'awaiting_merchant', 'preparing', 'ready', 'declined')
    and new.status in ('pending_dispatch', 'awaiting_merchant', 'preparing', 'ready', 'declined') then
    return new;
  end if;

  -- Merchant counter flow.
  if v_is_owner and old.merchant_id is not null and (
    (old.status = 'awaiting_merchant' and new.status in ('preparing', 'declined'))
    or (old.status = 'preparing' and new.status in ('ready', 'declined'))
  ) then
    return new;
  end if;

  -- Anything else reaching here is rejected so no role can skip the
  -- customer-confirmation step.
  raise exception 'Order cannot move from % to %.', old.status, new.status;
end;
$$;

drop trigger if exists trg_orders_validate_transition on public.orders;
create trigger trg_orders_validate_transition
before update of status on public.orders
for each row execute function public.validate_order_status_transition();

grant execute on function public.validate_order_status_transition() to anon, authenticated;

-- Status notifications: delivered nudge + confirmed-receipt copy ------------
-- (Patches the 0036 version of the function; everything else is unchanged.)

create or replace function public.on_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  v_owner record;
  v_rider record;
  v_rider_name text;
begin
  -- Audit every status transition (actor = whoever performed the write).
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.order_status_log (order_id, status, actor_role, actor_id)
    values (new.id, new.status, public.app_role(), auth.uid());
  end if;

  -- Customer-facing messages per state.
  if tg_op = 'INSERT' then
    if new.is_custom_list then
      -- Receipt for the customer.
      insert into public.notifications (user_id, order_id, kind, title, body)
      values (
        new.customer_id, new.id, 'pabili',
        'Pabili request sent',
        'Riders in ' || new.town::text || ' can now accept your list. You will be notified here once a rider takes it.'
      );
      -- Broadcast to on-duty riders in the same town. No order_id: tapping
      -- lands on the Rider tab (the rider order inbox), not customer Orders.
      for v_rider in
        select rider_id from public.rider_status
        where on_duty and current_town = new.town
      loop
        insert into public.notifications (user_id, kind, title, body)
        values (
          v_rider.rider_id, 'pabili',
          'New pabili request ' || new.order_number,
          'A customer in ' || new.town::text || ' needs items bought and delivered. Open the Rider tab to accept.'
        );
      end loop;
      return new;
    end if;
    v_title := 'Order sent to store';
    v_body := 'Your order ' || new.order_number || ' is waiting for the store to accept it.';
    insert into public.notifications (user_id, order_id, title, body)
    values (new.customer_id, new.id, v_title, v_body);
    -- Ping every owner of the merchant.
    for v_owner in
      select profile_id from public.merchant_owners where merchant_id = new.merchant_id
    loop
      insert into public.notifications (user_id, order_id, title, body)
      values (v_owner.profile_id, new.id, 'New order ' || new.order_number, 'A customer order needs your confirmation.');
    end loop;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- Pabili lifecycle messages for the customer (custom lists and merchant
    -- orders the customer flipped to rider-pabili read the same way: a rider
    -- shops at the store counter, then delivers).
    if (new.is_custom_list or new.fulfillment_mode = 'rider_pabili')
      and new.status in ('rider_assigned', 'items_purchased') then
      if new.status = 'rider_assigned' then
        select full_name into v_rider_name from public.profiles where id = new.rider_id;
        v_title := 'Rider found';
        v_body := coalesce(nullif(btrim(v_rider_name), '') || ' is shopping for you.', 'A rider is shopping for you.')
          || ' Order ' || new.order_number || '.';
      else
        v_title := 'Items purchased';
        v_body := 'Your rider bought everything for order ' || new.order_number || ' and is heading your way soon.';
      end if;
      insert into public.notifications (user_id, order_id, kind, title, body)
      values (new.customer_id, new.id, 'pabili', v_title, v_body);
      return new;
    end if;
    case new.status
      when 'preparing' then
        v_title := 'Store is preparing your order';
        v_body := 'Order ' || new.order_number || ' was accepted and is being packed.';
      when 'ready' then
        if new.fulfillment_mode = 'merchant_pickup' then
          v_title := 'Ready for pickup';
          v_body := 'Order ' || new.order_number || ' is ready. Show this code at the counter: ' || coalesce(new.claim_code, '—') || '.';
        else
          v_title := 'Ready, waiting for rider';
          v_body := 'Order ' || new.order_number || ' is packed. Claim code: ' || coalesce(new.claim_code, '—') || '.';
        end if;
      when 'declined' then
        v_title := 'Store is busy right now';
        v_body := 'The store cannot prepare order ' || new.order_number || '. Switch to rider pabili or cancel in the app.';
      when 'pending_dispatch' then
        v_title := 'Rider pabili activated';
        v_body := 'Order ' || new.order_number || ' is now open for riders to shop and deliver.';
      when 'in_transit' then
        v_title := 'Order on its way';
        v_body := 'Your rider picked up order ' || new.order_number || '.';
      when 'delivered' then
        v_title := 'Nadala na! Pakicheck';
        v_body := 'Your rider marked order ' || new.order_number || ' as delivered. Tap "Natanggap ko na" to confirm receipt.';
      when 'completed' then
        v_title := 'Order completed';
        v_body := 'Salamat sa pag-Pabili! You confirmed receipt of order ' || new.order_number || '. Enjoy!';
      when 'cancelled' then
        v_title := 'Order cancelled';
        v_body := 'Order ' || new.order_number || ' was cancelled.';
      else
        v_title := null;
    end case;
    if v_title is not null then
      insert into public.notifications (user_id, order_id, title, body)
      values (new.customer_id, new.id, v_title, v_body);
    end if;
  end if;
  return new;
end;
$$;

-- RLS ------------------------------------------------------------------------

-- Customer closes delivered orders (proof of receipt). The pre-dispatch
-- policy from 0014 is left untouched.
drop policy if exists "orders_update_customer_confirm" on public.orders;
create policy "orders_update_customer_confirm"
on public.orders
for update to authenticated
using (
  customer_id = auth.uid()
  and status = 'delivered'
)
with check (
  customer_id = auth.uid()
  and status = 'completed'
);

-- Riders advance deliveries but can no longer close them; closing is the
-- customer's tap (or the store counter handover function).
drop policy if exists "orders_update_rider_assigned" on public.orders;
create policy "orders_update_rider_assigned"
on public.orders
for update to authenticated
using (rider_id = auth.uid())
with check (
  rider_id = auth.uid()
  and status in ('pending_dispatch', 'rider_assigned', 'items_purchased', 'in_transit', 'delivered', 'cancelled', 'failed')
);

-- Chat stays open while receipt is unconfirmed.
drop policy if exists "order_messages_insert_participant" on public.order_messages;
create policy "order_messages_insert_participant"
on public.order_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_messages.order_id
      and (
        (
          o.rider_id is not null
          and (o.customer_id = auth.uid() or o.rider_id = auth.uid())
          and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'delivered')
        )
        or (
          o.merchant_id is not null
          and (o.customer_id = auth.uid() or public.is_merchant_owner(o.merchant_id))
          and o.status in ('awaiting_merchant', 'preparing', 'ready')
        )
      )
  )
);

-- Live GPS tracking stays visible until the customer confirms receipt.
drop policy if exists "rider_locations_select_tracking" on public.rider_locations;
create policy "rider_locations_select_tracking"
on public.rider_locations
for select to authenticated
using (
  rider_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.rider_id = rider_locations.rider_id
      and o.customer_id = auth.uid()
      and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'delivered')
  )
);

-- Counterparty reads (rider card, contact, license photo) stay visible while
-- receipt is unconfirmed, mirroring the profiles_select pattern.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.rider_id = public.profiles.id
      and o.customer_id = auth.uid()
      and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'delivered', 'completed')
  )
  or exists (
    select 1 from public.orders o
    where o.customer_id = public.profiles.id
      and o.rider_id = auth.uid()
      and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'delivered', 'completed')
  )
);

drop policy if exists "applications_select_customer" on public.rider_applications;
create policy "applications_select_customer"
on public.rider_applications
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.rider_id = rider_applications.rider_id
    and o.customer_id = auth.uid()
    and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'delivered', 'completed')
));

drop policy if exists "rider photo customer read" on storage.objects;
create policy "rider photo customer read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'onboarding-docs'
  and (storage.foldername(name))[3] = 'selfie.jpg'
  and exists (
    select 1 from public.orders o
    where o.customer_id = auth.uid()
      and o.rider_id::text = (storage.foldername(name))[2]
      and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'delivered', 'completed')
  )
);
