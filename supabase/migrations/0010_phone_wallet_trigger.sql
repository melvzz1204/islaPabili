-- =============================================================================
-- IslaPabili MVP v1.0 - 0010: restore phone + wallet on signup
-- 0009 (username identity) overwrote handle_new_user() and dropped two things
-- that phone-OTP signups depend on:
--   1. new.phone was no longer copied into profiles.phone, so onboarding
--      could not pre-fill the contact number for "Continue with phone" users.
--   2. the wallets insert was lost, so SMS-signup users ended up with no
--      wallet row (wallets.user_id is unique, service-role-only RLS).
-- This merges 0007 + 0008 + 0009: synthetic username emails are still nulled,
-- phone is carried over, and every new user gets a record-only wallet.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
  v_email text := new.email;
begin
  if v_email like '%@islapabili.internal' then
    v_email := null;
  end if;
  insert into public.profiles (id, email, phone, full_name, username)
  values (
    new.id,
    v_email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    v_username
  );

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
