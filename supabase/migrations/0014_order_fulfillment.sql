-- =============================================================================
-- IslaPabili MVP v1.0 - 0014: fulfillment choice, notifications & order RLS
--
-- Customer flow: checkout picks rider-delivery or self-pickup ->
-- orders.fulfillment_mode. Merchant accepts/prepares or declines; a decline
-- hands the choice back to the customer (rider shops instead, or cancel).
--
-- A single SECURITY DEFINER trigger writes the audit log + user
-- notifications on every transition, so mobile + merchant-web just read.
-- Realtime is enabled on orders + notifications for live in-app updates.
-- =============================================================================

-- Fulfillment mode ------------------------------------------------------------

alter table public.orders
  add column if not exists fulfillment_mode text not null default 'merchant_delivery'
  check (fulfillment_mode in ('merchant_delivery', 'merchant_pickup', 'rider_pabili'));

-- Notifications (in-app inbox) -------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  title text not null,
  body text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
on public.notifications
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "notifications_update_own"
on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Transition trigger: audit log + notifications --------------------------------

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
begin
  -- Audit every status transition (actor = whoever performed the write).
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.order_status_log (order_id, status, actor_role, actor_id)
    values (new.id, new.status, public.app_role(), auth.uid());
  end if;

  -- Customer-facing messages per state.
  if tg_op = 'INSERT' then
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

drop trigger if exists trg_orders_status_event on public.orders;
create trigger trg_orders_status_event
after insert or update of status on public.orders
for each row execute function public.on_order_status_event();

grant execute on function public.on_order_status_event() to anon, authenticated;

-- Customer order updates across the merchant lifecycle ------------------------

drop policy if exists "orders_update_customer_pending" on public.orders;
create policy "orders_update_customer_pending"
on public.orders
for update to authenticated
using (
  customer_id = auth.uid()
  and status in ('pending_dispatch', 'awaiting_merchant', 'preparing', 'ready', 'declined')
)
with check (
  customer_id = auth.uid()
  and status in ('pending_dispatch', 'awaiting_merchant', 'preparing', 'ready', 'declined', 'cancelled')
);

-- order_items can be attached while the merchant has not started packing -----

drop policy if exists "order_items_insert_owner" on public.order_items;
create policy "order_items_insert_owner"
on public.order_items
for insert to authenticated
with check (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.customer_id = auth.uid()
    and o.status in ('pending_dispatch', 'awaiting_merchant')
));

-- Merchants read + transition their own stores' orders ------------------------

create policy "orders_select_merchant"
on public.orders
for select to authenticated
using (
  merchant_id is not null
  and public.is_merchant_owner(merchant_id)
);

create policy "orders_update_merchant"
on public.orders
for update to authenticated
using (
  merchant_id is not null
  and public.is_merchant_owner(merchant_id)
)
with check (
  merchant_id is not null
  and public.is_merchant_owner(merchant_id)
);

create policy "order_items_select_merchant"
on public.order_items
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.merchant_id is not null
    and public.is_merchant_owner(o.merchant_id)
));

create policy "status_log_select_merchant"
on public.order_status_log
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_status_log.order_id
    and o.merchant_id is not null
    and public.is_merchant_owner(o.merchant_id)
));

-- Realtime for live in-app updates (idempotent: safe if already members) ------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
