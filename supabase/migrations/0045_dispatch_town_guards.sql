-- =============================================================================
-- IslaPabili MVP v1.0 - 0045: close out-of-area dispatch holes
--
-- Dispatch already offers each order only to riders covering its town
-- (request_pabili_riders: on_duty + town = ANY (operating_towns)). Three
-- holes remained around that rule:
--
--   1. accept_pabili_order() (legacy single-claim) had no town check and no
--      offer-row check, so any rider-role user could claim any open order by
--      calling it directly. It now rejects callers whose rider_status
--      operating_towns do not cover the order's town.
--
--   2. RLS orders_select_open_pabili (+ items) let ANY authenticated user
--      SELECT every open pabili order. It now only reveals an open order to
--      riders holding a live (current, unexpired, pending) offer row for it.
--      Customers/assigned riders/admins are unaffected: orders_select_participant
--      and order_items_select already cover them.
--
--   3. The new-pabili push broadcast in on_order_status_event() pinged riders
--      by physical current_town while offers go by coverage operating_towns.
--      It now pings riders covering the order town, matching the offer RPC.
-- =============================================================================

-- 1. Town guard on the legacy single-claim entry point ------------------------

create or replace function public.accept_pabili_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.orders;
  v_role public.user_role;
  v_town public.island_town;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role is distinct from 'rider' then
    raise exception 'Only riders can accept pabili requests'
      using errcode = '42501';
  end if;

  select town into v_town
  from public.orders
  where id = p_order_id
    and (is_custom_list or fulfillment_mode = 'rider_pabili')
    and status = 'pending_dispatch'
    and rider_id is null;

  if v_town is null then
    raise exception 'Pabili request % is no longer open', p_order_id
      using errcode = 'P0002';
  end if;

  -- Only riders covering the order's town may claim it (mirrors the
  -- town = ANY (operating_towns) filter in request_pabili_riders).
  if not exists (
    select 1 from public.rider_status s
    where s.rider_id = auth.uid()
      and v_town = any (s.operating_towns)
  ) then
    raise exception 'Order is outside your operating area'
      using errcode = '42501';
  end if;

  update public.orders
  set
    rider_id = auth.uid(),
    status = 'rider_assigned',
    accepted_at = now()
  where id = p_order_id
    and (is_custom_list or fulfillment_mode = 'rider_pabili')
    and status = 'pending_dispatch'
    and rider_id is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Pabili request % is no longer open', p_order_id
      using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

grant execute on function public.accept_pabili_order(uuid) to authenticated;

-- 2. Open-pabili RLS: offer-holders only ---------------------------------------

drop policy if exists "orders_select_open_pabili" on public.orders;
create policy "orders_select_open_pabili"
on public.orders
for select to authenticated
using (
  (is_custom_list or fulfillment_mode = 'rider_pabili')
  and status = 'pending_dispatch'
  and rider_id is null
  and exists (
    select 1 from public.order_requests r
    where r.order_id = orders.id
      and r.rider_id = auth.uid()
      and r.status = 'pending'
      and r.is_current
      and r.expires_at > now()
  )
);

drop policy if exists "order_items_select_open_pabili" on public.order_items;
create policy "order_items_select_open_pabili"
on public.order_items
for select to authenticated
using (exists (
  select 1
  from public.orders o
  join public.order_requests r on r.order_id = o.id
  where o.id = order_items.order_id
    and (o.is_custom_list or o.fulfillment_mode = 'rider_pabili')
    and o.status = 'pending_dispatch'
    and o.rider_id is null
    and r.rider_id = auth.uid()
    and r.status = 'pending'
    and r.is_current
    and r.expires_at > now()
));

-- 3. Push broadcast by coverage, not physical town -----------------------------
-- (Patches the 0039 version of the function; everything else is unchanged.)

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
      -- Broadcast to on-duty riders covering the order town (same coverage
      -- rule as request_pabili_riders). No order_id: tapping lands on the
      -- Rider tab (the rider order inbox), not customer Orders.
      for v_rider in
        select rider_id from public.rider_status
        where on_duty and new.town = any (operating_towns)
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
