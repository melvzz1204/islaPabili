-- =============================================================================
-- IslaPabili MVP v1.0 - 0043: customer <-> store pre-order inquiries
--
-- Customers can message a store BEFORE placing an order (ask about stock,
-- price, availability). No order row needed — the thread is keyed by
-- (merchant_id, customer_id).
--
-- Jollibee is intentionally NOT part of this flow: it is rider-delivery-only
-- (see JollibeeMenuScreen + isJollibeeMerchantName), so the mobile UI hides
-- the "Message store" entry for Jollibee-named merchants. The table itself
-- stays generic; the exclusion lives in the app layer.
-- =============================================================================

-- Inbox needs a store reference for order-less threads -----------------------
alter table public.notifications
  add column if not exists merchant_id uuid references public.merchants (id) on delete cascade;

create index if not exists notifications_merchant_idx
  on public.notifications (merchant_id, created_at desc);

-- Pre-order threads ------------------------------------------------------------
create table public.store_messages (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index store_messages_merchant_idx on public.store_messages (merchant_id, created_at desc);
create index store_messages_customer_idx on public.store_messages (customer_id, created_at desc);
create index store_messages_thread_idx on public.store_messages (merchant_id, customer_id, created_at);

alter table public.store_messages enable row level security;

-- Readers: the customer + any owner of the store + admin -----------------------
create policy "store_messages_select_thread"
on public.store_messages
for select to authenticated
using (
  customer_id = auth.uid()
  or public.is_merchant_owner(merchant_id)
  or public.is_admin()
);

-- Writers: customer or store owner, as themselves, on an active store ---------
create policy "store_messages_insert_thread"
on public.store_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and (customer_id = auth.uid() or public.is_merchant_owner(merchant_id))
  and exists (
    select 1 from public.merchants m
    where m.id = store_messages.merchant_id and m.is_active
  )
);

grant select, insert on public.store_messages to authenticated;
grant all on public.store_messages to service_role;

-- Notify the other side on each new inquiry ------------------------------------
create or replace function public.on_store_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant_name text;
  v_sender_name text;
  v_recipient uuid;
begin
  select name into v_merchant_name from public.merchants where id = new.merchant_id;
  select coalesce(nullif(full_name, ''), 'New message') into v_sender_name
  from public.profiles where id = new.sender_id;

  if new.sender_id = new.customer_id then
    -- Customer wrote: wake every owner of the store.
    for v_recipient in
      select profile_id from public.merchant_owners where merchant_id = new.merchant_id
    loop
      insert into public.notifications (user_id, order_id, merchant_id, kind, title, body)
      values (
        v_recipient, null, new.merchant_id, 'message',
        'New inquiry · ' || coalesce(v_merchant_name, 'your store'),
        v_sender_name || ': ' || left(new.body, 120)
      );
    end loop;
  else
    -- Store owner wrote: wake the customer.
    insert into public.notifications (user_id, order_id, merchant_id, kind, title, body)
    values (
      new.customer_id, null, new.merchant_id, 'message',
      coalesce(v_merchant_name, 'Store') || ' replied',
      v_sender_name || ': ' || left(new.body, 120)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_store_messages_notify on public.store_messages;
create trigger trg_store_messages_notify
after insert on public.store_messages
for each row execute function public.on_store_message_created();

-- Realtime for live pre-order chat ------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'store_messages'
  ) then
    alter publication supabase_realtime add table public.store_messages;
  end if;
end
$$;
