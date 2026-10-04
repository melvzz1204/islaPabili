-- =============================================================================
-- IslaPabili MVP v1.0 - 0037: merchant <-> customer order messaging
--
-- The per-order chat (0026) opens to the store: while a store order is being
-- confirmed, packed or waiting at the counter, the customer and any owner of
-- the merchant can exchange messages. No new tables, no external service —
-- the same Supabase Realtime thread the rider chat already uses.
-- =============================================================================

-- Readers: customer / assigned rider / store owners / admin -------------------

drop policy if exists "order_messages_select_participant" on public.order_messages;
create policy "order_messages_select_participant"
on public.order_messages
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_messages.order_id
    and (
      o.customer_id = auth.uid()
      or o.rider_id = auth.uid()
      or public.is_admin()
      or (o.merchant_id is not null and public.is_merchant_owner(o.merchant_id))
    )
));

-- Writers: rider flow unchanged; store flow covers confirm/pack/ready --------

drop policy if exists "order_messages_insert_participant" on public.order_messages;
create policy "order_messages_insert_participant"
on public.order_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_messages.order_id
      and (
        (
          o.rider_id is not null
          and (o.customer_id = auth.uid() or o.rider_id = auth.uid())
          and o.status in ('rider_assigned', 'items_purchased', 'in_transit')
        )
        or (
          o.merchant_id is not null
          and (o.customer_id = auth.uid() or public.is_merchant_owner(o.merchant_id))
          and o.status in ('awaiting_merchant', 'preparing', 'ready')
        )
      )
  )
);

-- Notify every other side on each new message ---------------------------------

create or replace function public.on_order_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_sender_name text;
  v_recipient uuid;
begin
  select * into v_order from public.orders where id = new.order_id;
  if v_order.id is null then
    return new;
  end if;

  select coalesce(nullif(full_name, ''), 'New message') into v_sender_name
  from public.profiles where id = new.sender_id;

  -- The rider side (unchanged): rider <-> customer wake each other.
  if new.sender_id = v_order.customer_id and v_order.rider_id is not null then
    insert into public.notifications (user_id, order_id, kind, title, body)
    values (
      v_order.rider_id, new.order_id, 'message',
      'New message · ' || v_order.order_number,
      v_sender_name || ': ' || left(new.body, 120)
    );
  elsif new.sender_id = v_order.rider_id and v_order.rider_id is not null then
    insert into public.notifications (user_id, order_id, kind, title, body)
    values (
      v_order.customer_id, new.order_id, 'message',
      'New message · ' || v_order.order_number,
      v_sender_name || ': ' || left(new.body, 120)
    );
  end if;

  -- The store side: customer and store owners wake each other, but only while
  -- the store is the active party (confirm/pack/ready). Past handover the
  -- rider thread owns the conversation.
  if v_order.merchant_id is not null
    and v_order.status in ('awaiting_merchant', 'preparing', 'ready') then
    if new.sender_id = v_order.customer_id then
      for v_recipient in
        select profile_id from public.merchant_owners where merchant_id = v_order.merchant_id
      loop
        insert into public.notifications (user_id, order_id, kind, title, body)
        values (
          v_recipient, new.order_id, 'message',
          'New message · ' || v_order.order_number,
          v_sender_name || ': ' || left(new.body, 120)
        );
      end loop;
    else
      insert into public.notifications (user_id, order_id, kind, title, body)
      values (
        v_order.customer_id, new.order_id, 'message',
        'New message · ' || v_order.order_number,
        v_sender_name || ': ' || left(new.body, 120)
      );
    end if;
  end if;

  return new;
end;
$$;
