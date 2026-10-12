-- =============================================================================
-- IslaPabili MVP v1.0 - 0047: never self-notify on messages
--
-- Found live: a store owner messaging their own store (same profile as the
-- customer) received "New inquiry" notification rows about their OWN
-- messages. The app correctly treats own messages as read, so the message
-- badge stays 0 while stale bell rows suggest otherwise — confusing.
--
-- Both message triggers now skip recipients that ARE the sender:
--   1. on_store_message_created() (0043): owner loop excludes the sender.
--   2. on_order_message_created() (0037): store-side owner loop excludes the
--      sender (rider/customer branches already route to the other party).
-- Bodies are otherwise byte-identical to their previous versions.
-- =============================================================================

-- 1. Pre-order inquiries -------------------------------------------------------

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
    -- Customer wrote: wake every owner of the store, except the sender
    -- themselves (owner testing their own storefront).
    for v_recipient in
      select profile_id from public.merchant_owners
      where merchant_id = new.merchant_id
        and profile_id is distinct from new.sender_id
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

-- 2. Per-order chat, store side -------------------------------------------------

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
  -- rider thread owns the conversation. Owners never notify themselves.
  if v_order.merchant_id is not null
    and v_order.status in ('awaiting_merchant', 'preparing', 'ready') then
    if new.sender_id = v_order.customer_id then
      for v_recipient in
        select profile_id from public.merchant_owners
        where merchant_id = v_order.merchant_id
          and profile_id is distinct from new.sender_id
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
