-- =============================================================================
-- IslaPabili MVP v1.0 - 0007: wallet auto-creation
-- handle_new_user() previously created only the profile. Every user gets a
-- record-only wallet (COD-first MVP); the service-role-only RLS on wallets means
-- the trigger (SECURITY DEFINER) is the only safe path to create it.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  );

  insert into public.wallets (user_id)
  values (new.id);

  return new;
end;
$$;