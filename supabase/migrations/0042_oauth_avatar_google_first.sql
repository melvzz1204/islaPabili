-- =============================================================================
-- IslaPabili MVP v1.0 - 0042: prefer Google photo over expiring FB lookaside
-- Facebook platform-lookaside URLs expire and often fail inside React
-- Native's image loader. Identities live in the auth.identities table (there
-- is no auth.users.identities column), and identity rows may not exist yet
-- when the on-user-created trigger fires — so the trigger keeps reading
-- top-level user_metadata (correct for single-provider signups), while the
-- repair below and the app-side login sync prefer the Google identity photo
-- for linked (Google + Facebook) accounts.
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

-- Repair rows holding an expiring Facebook lookaside URL (or no avatar at
-- all) where a Google identity photo is available.
update public.profiles p
set avatar_url = g.avatar
from (
  select distinct on (i.user_id)
    i.user_id,
    nullif(i.identity_data ->> 'picture', '') as avatar
  from auth.identities i
  where i.provider = 'google'
  order by i.user_id
) g
where g.user_id = p.id
  and g.avatar is not null
  and (
    p.avatar_url is null
    or p.avatar_url = ''
    or p.avatar_url like '%platform-lookaside.fbsbx.com%'
  );
