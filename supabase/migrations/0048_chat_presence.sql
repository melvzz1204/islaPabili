-- =============================================================================
-- IslaPabili MVP v1.0 - 0048: chat presence (Messenger-style online status)
--
-- Chat headers show a green dot + "Active now" when the counterpart is
-- online, else "Active Xm/Xh ago". Activity source: push_tokens.updated_at,
-- refreshed on every app foreground (registerPushToken). That table is
-- self-readable only, so two SECURITY DEFINER RPCs expose the minimum:
--
--   presence_for(p_user_id) — last activity of a chat contact. Guarded: the
--     caller must share an order (customer/rider/owner) or a store thread
--     with the target, else NULL. Own id always resolves (RLS allows it).
--
--   store_presence(p_merchant_id) — max activity across the store's owners.
--     Storefronts are public, so any signed-in user may read it (used by the
--     customer inquiry header). NULL when the store has no owner activity.
-- =============================================================================

create or replace function public.presence_for(p_user_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  if auth.uid() is null then
    return null;
  end if;

  if auth.uid() = p_user_id then
    select max(updated_at) into v_last
    from public.push_tokens
    where user_id = p_user_id;
    return v_last;
  end if;

  -- Contact guard: shared order (any direction/role) or shared store thread.
  if not exists (
    select 1 from public.orders o
    where (o.customer_id = auth.uid() and (o.rider_id = p_user_id
           or o.merchant_id in (select merchant_id from public.merchant_owners where profile_id = p_user_id)))
       or (o.rider_id = auth.uid() and o.customer_id = p_user_id)
       or (o.merchant_id in (select merchant_id from public.merchant_owners where profile_id = auth.uid())
           and o.customer_id = p_user_id)
  ) and not exists (
    select 1 from public.store_messages sm
    where (sm.customer_id = auth.uid()
           and sm.merchant_id in (select merchant_id from public.merchant_owners where profile_id = p_user_id))
       or (sm.merchant_id in (select merchant_id from public.merchant_owners where profile_id = auth.uid())
           and sm.customer_id = p_user_id)
  ) then
    return null;
  end if;

  select max(updated_at) into v_last
  from public.push_tokens
  where user_id = p_user_id;
  return v_last;
end;
$$;

grant execute on function public.presence_for(uuid) to authenticated;

create or replace function public.store_presence(p_merchant_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  if auth.uid() is null then
    return null;
  end if;

  select max(pt.updated_at) into v_last
  from public.push_tokens pt
  join public.merchant_owners mo on mo.profile_id = pt.user_id
  where mo.merchant_id = p_merchant_id;
  return v_last;
end;
$$;

grant execute on function public.store_presence(uuid) to authenticated;
