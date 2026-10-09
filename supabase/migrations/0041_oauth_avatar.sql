-- =============================================================================
-- IslaPabili MVP v1.0 - 0041: OAuth avatar sync (Google / Facebook)
-- Supabase Auth stores the provider profile picture in
-- auth.users.raw_user_meta_data as `picture` (Google/Facebook) and/or
-- `avatar_url`. Carry it into public.profiles so the app can display the
-- same photo the user has on their provider account.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture',
        ''
      ),
      ''
    )
  );

  insert into public.wallets (user_id)
  values (new.id);

  return new;
end;
$$;

-- Backfill existing OAuth users whose profile never got an avatar.
update public.profiles p
set avatar_url = src.avatar
from (
  select
    u.id,
    nullif(
      coalesce(
        u.raw_user_meta_data ->> 'avatar_url',
        u.raw_user_meta_data ->> 'picture',
        ''
      ),
      ''
    ) as avatar
  from auth.users u
) src
where src.id = p.id
  and src.avatar is not null
  and (p.avatar_url is null or p.avatar_url = '');
