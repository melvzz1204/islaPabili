-- =============================================================================
-- IslaPabili MVP v1.0 - 0036: merchant claim flow
--
-- Store registration captures owner name, description + logo. When a store
-- marks an order ready, a short claim code is minted server-side and a
-- store-confirmed receipt (final per-line prices) is frozen. Whoever picks
-- up (customer or rider) shows the code; the store verifies it with
-- verify_claim_code(), which completes the handover atomically.
-- =============================================================================

-- Storefront profile fields ---------------------------------------------------

alter table public.merchants
  add column if not exists description text;

alter table public.merchant_applications
  add column if not exists owner_name text,
  add column if not exists description text,
  add column if not exists logo_url text;

-- Approval now carries the new fields onto the live storefront -------------

create or replace function public.on_merchant_application_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant_id uuid;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into public.merchants (name, category, town, address, phone, description, logo_url, is_active)
    values (new.store_name, new.category, new.town, new.address, new.phone, new.description, new.logo_url, true)
    returning id into v_merchant_id;

    insert into public.merchant_owners (merchant_id, profile_id)
    values (v_merchant_id, new.applicant_id)
    on conflict do nothing;

    update public.profiles
    set
      role = 'merchant',
      full_name = coalesce(nullif(public.profiles.full_name, ''), new.owner_name, public.profiles.full_name)
    where id = new.applicant_id;
  end if;
  return new;
end;
$$;

-- Claim code + receipt snapshot on orders ------------------------------------

alter table public.orders
  add column if not exists claim_code text,
  add column if not exists claimed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_claim_code_unique'
  ) then
    alter table public.orders add constraint orders_claim_code_unique unique (claim_code);
  end if;
end
$$;

-- Store-confirmed per-line price. Null = fall back to estimated_price.
alter table public.order_items
  add column if not exists final_price numeric(12,2);

-- Claim code minting ----------------------------------------------------------

create or replace function public.generate_claim_code()
returns text
language plpgsql
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_tries int := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, (floor(random() * length(v_alphabet)) + 1)::int, 1);
    end loop;
    v_tries := v_tries + 1;
    exit when not exists (select 1 from public.orders where claim_code = v_code);
    if v_tries >= 25 then
      raise exception 'Could not mint a unique claim code.';
    end if;
  end loop;
  return v_code;
end;
$$;

create or replace function public.mint_claim_code_on_ready()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ready'
    and (old.status is distinct from 'ready')
    and new.claim_code is null
    and new.merchant_id is not null then
    new.claim_code := public.generate_claim_code();
    new.claimed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_mint_claim_code on public.orders;
create trigger trg_orders_mint_claim_code
before update of status on public.orders
for each row execute function public.mint_claim_code_on_ready();

-- Atomic verify-and-complete at the counter -----------------------------------

create or replace function public.verify_claim_code(p_order_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  select id, merchant_id, status, claim_code
  into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.merchant_id is null or not public.is_merchant_owner(v_order.merchant_id) then
    raise exception 'Only the store can verify this order.';
  end if;
  if v_order.status <> 'ready' then
    raise exception 'Order is not ready for pickup.';
  end if;
  if v_order.claim_code is null or v_order.claim_code <> v_code then
    raise exception 'Code does not match. Check the code and try again.';
  end if;

  update public.orders
  set status = 'completed', completed_at = now(), claimed_at = now()
  where id = p_order_id;

  return true;
end;
$$;

grant execute on function public.generate_claim_code() to anon, authenticated;
grant execute on function public.mint_claim_code_on_ready() to anon, authenticated;
grant execute on function public.verify_claim_code(uuid, text) to authenticated;

-- Merchants confirm final per-line prices ------------------------------------

drop policy if exists "order_items_update_merchant" on public.order_items;
create policy "order_items_update_merchant"
on public.order_items
for update to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.merchant_id is not null
    and public.is_merchant_owner(o.merchant_id)
    and o.status in ('awaiting_merchant', 'preparing')
))
with check (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.merchant_id is not null
    and public.is_merchant_owner(o.merchant_id)
    and o.status in ('awaiting_merchant', 'preparing')
));

-- Ready notifications now carry the claim code --------------------------------
-- (Patches the 0031 version of the function; everything else is unchanged.)

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

-- Store logos: public read (customers browse), owners write own folder --------

insert into storage.buckets (id, name, public)
values ('store-logos', 'store-logos', true)
on conflict (id) do nothing;

drop policy if exists "store logos public read" on storage.objects;
create policy "store logos public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'store-logos');

drop policy if exists "store logos insert own" on storage.objects;
create policy "store logos insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'store-logos'
  and (storage.foldername(name))[1] = 'store-logos'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "store logos update own" on storage.objects;
create policy "store logos update own"
on storage.objects for update
to authenticated
using (bucket_id = 'store-logos' and owner_id = auth.uid()::text)
with check (
  bucket_id = 'store-logos'
  and (storage.foldername(name))[1] = 'store-logos'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "store logos delete own" on storage.objects;
create policy "store logos delete own"
on storage.objects for delete
to authenticated
using (bucket_id = 'store-logos' and owner_id = auth.uid()::text);
