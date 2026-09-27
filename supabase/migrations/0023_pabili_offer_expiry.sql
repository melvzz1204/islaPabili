-- =============================================================================
-- IslaPabili MVP v1.0 - 0023: Pabili offer expiry
--
-- Offers carry a 5-minute window (expires_at, set in 0022). Batches and
-- retries are driven lazily — no cron — so this closes the remaining hole:
-- respond_pabili_request now refuses expired rows, so a rider who taps an
-- offer after its window gets "no longer open" instead of stealing a stale
-- claim. The app hides expired offers from the rider inbox and nudges the
-- customer to retry once their round lapses.
-- =============================================================================

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
