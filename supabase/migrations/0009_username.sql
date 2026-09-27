-- =============================================================================
-- IslaPabili MVP v1.0 - 0009: Username identity
-- Usernames are the primary credential; email is optional. Users without a
-- real email authenticate with a synthetic email on the reserved domain
-- <username>@islapabili.internal (see packages/shared USERNAME_AUTH_DOMAIN).
-- =============================================================================

alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_key
  on public.profiles (username);

-- Capture username from signup metadata; never store synthetic auth emails
-- in profiles.email (keep it for real, contactable emails only).
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
  insert into public.profiles (id, email, full_name, username)
  values (
    new.id,
    v_email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    v_username
  );
  return new;
end;
$$;

-- Friendly "username taken" pre-check for signup. Boolean-only result so no
-- profile data leaks; unique constraints remain the enforcing backstop.
create or replace function public.is_username_taken(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where username = p_username);
$$;

grant execute on function public.is_username_taken(text) to anon, authenticated;
