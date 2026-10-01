-- =============================================================================
-- IslaPabili MVP v1.0 - 0031: Dispatch covers merchant rider-pabili orders
--
-- Bug: the merchant checkout "Find a rider now" button (and the declined
-- order "Let a rider shop for me" switch) flips a merchant order into the
-- rider-shops flow, but every dispatch surface was custom-list-only:
--   - request_pabili_riders() / respond_pabili_request() / accept_pabili_order()
--     all required is_custom_list, so the RPC rejected merchant orders;
--   - RLS orders_select_open_pabili (+ items) hid merchant orders from riders,
--     so the rider inbox stayed empty even if a round existed.
--
-- Rule from here on: anything in pending_dispatch with
-- (is_custom_list or fulfillment_mode = 'rider_pabili') is dispatchable.
-- The client flips merchant orders to { status: 'pending_dispatch',
-- fulfillment_mode: 'rider_pabili' } exactly when the customer asks a rider
-- to shop instead (checkout find-a-rider, declined-order switch).
-- =============================================================================

-- Offer RPC: same rounds/dedupe, now also for flipped merchant orders --------

create or replace function public.request_pabili_riders(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_rider record;
  v_count integer := 0;
  v_had_round boolean;
  v_prev_riders uuid[];
begin
  select * into v_order
  from public.orders
  where id = p_order_id
    and customer_id = auth.uid()
    and (is_custom_list or fulfillment_mode = 'rider_pabili')
    and status = 'pending_dispatch'
    and rider_id is null;

  if v_order.id is null then
    raise exception 'Pabili request % is not open for dispatch', p_order_id
      using errcode = 'P0002';
  end if;

  -- Who already got a round for this order (before we clear it below)?
  select coalesce(array_agg(distinct rider_id), '{}') into v_prev_riders
  from public.order_requests
  where order_id = p_order_id;

  v_had_round := coalesce(array_length(v_prev_riders, 1), 0) > 0;

  -- A retry replaces the spent round instead of stacking onto it (the
  -- unique(order_id, rider_id) key forbids two live rows per rider anyway).
  delete from public.order_requests
  where order_id = p_order_id;

  -- On duty + covering this town (operating area is kept fresh on the
  -- rider's duty heartbeat; physical town doesn't matter, coverage does).
  for v_rider in
    select rider_id
    from public.rider_status
    where on_duty
      and v_order.town = any (operating_towns)
  loop
    insert into public.order_requests (order_id, rider_id, status, expires_at, is_current)
    values (p_order_id, v_rider.rider_id, 'pending', now() + interval '5 minutes', true);
    v_count := v_count + 1;

    -- The first offer rides on the submit broadcast; retries only ping
    -- riders who never got a round (just went on duty), so one list never
    -- spams the same bell twice.
    if v_had_round and not (v_rider.rider_id = any (v_prev_riders)) then
      insert into public.notifications (user_id, kind, title, body)
      values (
        v_rider.rider_id, 'pabili',
        'Pabili request ' || v_order.order_number || ' still open',
        'A customer in ' || v_order.town::text || ' is still looking for a rider. Open the Rider tab to accept.'
      );
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.request_pabili_riders(uuid) to authenticated;

-- Respond RPC: same first-accept-wins + expiry, now also for flipped orders ---

create or replace function public.respond_pabili_request(p_order_id uuid, p_decision text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if p_decision not in ('accepted', 'declined') then
    raise exception 'Decision must be accepted or declined, got %', p_decision
      using errcode = '22023';
  end if;

  -- The caller must hold a live, unexpired request for this order.
  update public.order_requests
  set status = p_decision::public.request_status, responded_at = now()
  where order_id = p_order_id
    and rider_id = auth.uid()
    and status = 'pending'
    and is_current
    and expires_at > now();

  if not found then
    raise exception 'No open pabili offer for this rider on order %', p_order_id
      using errcode = 'P0002';
  end if;

  if p_decision = 'declined' then
    select * into v_order from public.orders where id = p_order_id;
    return v_order;
  end if;

  -- Accept: first writer wins; everyone else hits the "no longer open" error.
  update public.orders
  set
    rider_id = auth.uid(),
    status = 'rider_assigned',
    accepted_at = now()
  where id = p_order_id
    and (is_custom_list or fulfillment_mode = 'rider_pabili')
    and status = 'pending_dispatch'
    and rider_id is null
  returning * into v_order;

  if v_order.id is null then
    raise exception 'Another rider already accepted this pabili'
      using errcode = 'P0002';
  end if;

  -- Close the round so late accepts fail fast on the request check above.
  update public.order_requests
  set is_current = false
  where order_id = p_order_id
    and rider_id <> auth.uid();

  return v_order;
end;
$$;

grant execute on function public.respond_pabili_request(uuid, text) to authenticated;

-- Legacy single-claim entry point: same widening for consistency ------------

create or replace function public.accept_pabili_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.orders;
  v_role public.user_role;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role is distinct from 'rider' then
    raise exception 'Only riders can accept pabili requests'
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

-- RLS: riders can browse flipped merchant orders (+ items) while open --------

drop policy if exists "orders_select_open_pabili" on public.orders;
create policy "orders_select_open_pabili"
on public.orders
for select to authenticated
using (
  (is_custom_list or fulfillment_mode = 'rider_pabili')
  and status = 'pending_dispatch'
);

drop policy if exists "order_items_select_open_pabili" on public.order_items;
create policy "order_items_select_open_pabili"
on public.order_items
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and (o.is_custom_list or o.fulfillment_mode = 'rider_pabili')
    and o.status = 'pending_dispatch'
));

-- Lifecycle copy: flipped merchant orders read as rider-pabili --------------

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
          v_body := 'Order ' || new.order_number || ' is ready. Show this number at the counter.';
        else
          v_title := 'Ready, waiting for rider';
          v_body := 'Order ' || new.order_number || ' is packed and waiting for rider pickup.';
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
      when 'completed' then
        v_title := 'Order completed';
        v_body := 'Salamat sa pag-Pabili! Order ' || new.order_number || ' is done.';
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
