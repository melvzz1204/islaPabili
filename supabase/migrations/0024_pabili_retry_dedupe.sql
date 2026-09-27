-- =============================================================================
-- IslaPabili MVP v1.0 - 0024: Pabili retry without duplicates
--
-- Two problems with request_pabili_riders() from 0022:
--   1. Retrying closed old rounds with is_current=false but KEPT the rows,
--      so the fresh INSERT hit unique(order_id, rider_id) and every retry
--      errored out.
--   2. Every retry re-notified ALL on-duty riders, so one list produced a
--      pile of identical bell notifications.
--
-- Now a retry deletes the spent round and only pings riders who have not
-- heard about this order yet (e.g. just went on duty). Riders already
-- holding the inbox card + realtime feed need no second ping.
-- =============================================================================

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
    and is_custom_list
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

    -- The first offer rides on the 0021 submit broadcast; retries only ping
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
