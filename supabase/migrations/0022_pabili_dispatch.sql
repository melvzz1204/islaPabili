-- =============================================================================
-- IslaPabili MVP v1.0 - 0022: Pabili dispatch (offer / accept / decline)
--
-- The pabili flow is now dispatch-driven instead of an open pool:
--   1. Customer sends a custom list -> request_pabili_riders() offers it to
--      every ON-DUTY rider whose approved operating area covers the town.
--      One order_requests row per rider (5-minute window).
--   2. Riders accept or decline their own request. First accept wins
--      atomically (respond_pabili_request); a decline just passes it on.
--   3. No accept -> the customer retries (request again), which opens a fresh
--      round and re-notifies whoever is on duty.
--
-- Also: orders.store_name (picked or typed store), rider GPS on
-- rider_status, and order_requests on the realtime publication.
-- =============================================================================

-- Columns ---------------------------------------------------------------------

alter table public.orders
  add column if not exists store_name text;

alter table public.rider_status
  add column if not exists current_lat double precision;

alter table public.rider_status
  add column if not exists current_lng double precision;

-- Offer RPC -------------------------------------------------------------------

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
begin
  select * into v_order
  from public.orders
  where id = p_order_id
    and customer_id = auth.uid()
    and is_custom_list
    and status = 'pending_dispatch'
    and rider_id is null;

  if v_order.id is null then
    raise exception 'Pabili request % is not open for dispatch', p_order_id
      using errcode = 'P0002';
  end if;

  -- A retry closes the previous round so only one round is live at a time.
  select exists (
    select 1 from public.order_requests where order_id = p_order_id
  ) into v_had_round;

  update public.order_requests
  set is_current = false
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

    -- The first offer rides on the 0021 submit broadcast; retries re-notify
    -- so newly on-duty riders hear about it.
    if v_had_round then
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

-- Respond RPC -----------------------------------------------------------------

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

  -- The caller must hold a live request for this order.
  update public.order_requests
  set status = p_decision::public.request_status, responded_at = now()
  where order_id = p_order_id
    and rider_id = auth.uid()
    and status = 'pending'
    and is_current;

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
    and is_custom_list
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

-- Realtime for the rider inbox --------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_requests'
  ) then
    alter publication supabase_realtime add table public.order_requests;
  end if;
end
$$;
