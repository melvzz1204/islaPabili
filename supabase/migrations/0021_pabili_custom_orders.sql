-- =============================================================================
-- IslaPabili MVP v1.0 - 0021: Customer pabili lists (custom orders)
--
-- Customers can type a free-text shopping list (no merchant catalog) and
-- riders accept it. This reuses the existing custom-order foundation:
-- orders.is_custom_list + free-text order_items + the rider lifecycle
-- (pending_dispatch -> rider_assigned -> items_purchased -> in_transit ->
-- completed).
--
-- This adds:
--   1. accept_pabili_order() — single server-side entry point for a rider to
--      claim an open custom order (riders cannot self-assign via RLS, so the
--      check-and-claim must be atomic here).
--   2. RLS so riders can SEE open custom orders (+ their items) before
--      accepting. Lifecycle updates after accept already work through
--      orders_update_rider_assigned; cancels through
--      orders_update_customer_pending.
--   3. Pabili copy in on_order_status_event: receipt + on-duty rider broadcast
--      on submit, "rider found" on accept, "items purchased" on purchase.
-- =============================================================================

-- Accept RPC ------------------------------------------------------------------

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
    and is_custom_list
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

-- RLS: riders can browse open custom orders -----------------------------------

drop policy if exists "orders_select_open_pabili" on public.orders;
create policy "orders_select_open_pabili"
on public.orders
for select to authenticated
using (is_custom_list and status = 'pending_dispatch');

drop policy if exists "order_items_select_open_pabili" on public.order_items;
create policy "order_items_select_open_pabili"
on public.order_items
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.is_custom_list
    and o.status = 'pending_dispatch'
));

-- Notifications ----------------------------------------------------------------
-- Same trigger as 0014, extended with pabili copy. Merchant-order branches are
-- unchanged; custom orders take their own branches.

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
    -- Pabili lifecycle messages for the customer.
    if new.is_custom_list and new.status in ('rider_assigned', 'items_purchased') then
      if new.status = 'rider_assigned' then
        select full_name into v_rider_name from public.profiles where id = new.rider_id;
        v_title := 'Rider found';
        v_body := coalesce(nullif(btrim(v_rider_name), '') || ' is shopping for you.', 'A rider is shopping for you.')
          || ' Order ' || new.order_number || '.';
      else
        v_title := 'Items purchased';
        v_body := 'Your rider bought everything on the list for order ' || new.order_number || ' and is heading your way soon.';
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
