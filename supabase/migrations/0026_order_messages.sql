-- =============================================================================
-- IslaPabili MVP v1.0 - 0026: Rider <-> customer order messaging
--
-- Per-order chat: customer and assigned rider exchange messages while the
-- order is active. Realtime-enabled; a SECURITY DEFINER trigger notifies
-- the other participant so the bell + Messages badge light up.
-- =============================================================================

create table public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index order_messages_order_idx on public.order_messages (order_id, created_at desc);
create index order_messages_sender_idx on public.order_messages (sender_id, created_at desc);

alter table public.order_messages enable row level security;

-- Participants (customer / assigned rider) + admin can read.
create policy "order_messages_select_participant"
on public.order_messages
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_messages.order_id
    and (o.customer_id = auth.uid() or o.rider_id = auth.uid() or public.is_admin())
));

-- Participants send as themselves only, while a rider is attached and the
-- order is still active (no chatting on pending/cancelled/completed orders).
create policy "order_messages_insert_participant"
on public.order_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_messages.order_id
      and o.rider_id is not null
      and (o.customer_id = auth.uid() or o.rider_id = auth.uid())
      and o.status in ('rider_assigned', 'items_purchased', 'in_transit')
  )
);

grant select, insert on public.order_messages to authenticated;
grant all on public.order_messages to service_role;

-- Notify the other participant on each new message ----------------------------

create or replace function public.on_order_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_other uuid;
  v_sender_name text;
begin
  select * into v_order from public.orders where id = new.order_id;
  if v_order.id is null then
    return new;
  end if;

  if new.sender_id = v_order.customer_id then
    v_other := v_order.rider_id;
  elsif new.sender_id = v_order.rider_id then
    v_other := v_order.customer_id;
  else
    return new;
  end if;

  if v_other is null then
    return new;
  end if;

  select coalesce(nullif(full_name, ''), 'Your rider') into v_sender_name
  from public.profiles where id = new.sender_id;

  insert into public.notifications (user_id, order_id, kind, title, body)
  values (
    v_other, new.order_id, 'message',
    'New message · ' || v_order.order_number,
    v_sender_name || ': ' || left(new.body, 120)
  );
  return new;
end;
$$;

drop trigger if exists trg_order_messages_notify on public.order_messages;
create trigger trg_order_messages_notify
after insert on public.order_messages
for each row execute function public.on_order_message_created();

-- Realtime for live chat -------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_messages'
  ) then
    alter publication supabase_realtime add table public.order_messages;
  end if;
end
$$;
