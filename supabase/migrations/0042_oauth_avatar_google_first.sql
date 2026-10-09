-- =============================================================================
-- IslaPabili MVP v1.0 - 0042: prefer Google photo over expiring FB lookaside
-- Facebook platform-lookaside URLs expire and often fail inside React
-- Native's image loader. When an account has both identities linked, store
-- the Google photo (long-lived) instead of whatever sits in top-level
-- user_metadata. Also repairs rows written by 0041 with an FB lookaside URL.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  google_pic text;
begin
  select nullif(elem -> 'identity_data' ->> 'picture', '')
    into google_pic
  from jsonb_array_elements(coalesce(new.identities, '[]'::jsonb)) as elem
  where elem ->> 'provider' = 'google'
  limit 1;

  insert into public.profiles (id, email, phone, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(
      google_pic,
      nullif(
        coalesce(
          new.raw_user_meta_data ->> 'avatar_url',
          new.raw_user_meta_data ->> 'picture',
          ''
        ),
        ''
      )
    )
  );

  insert into public.wallets (user_id)
  values (new.id);

  return new;
end;
$$;

-- Repair rows holding an expiring Facebook lookaside URL where a Google
-- identity photo is available.
update public.profiles p
set avatar_url = src.avatar
from (
  select
    u.id,
    (
      select nullif(elem -> 'identity_data' ->> 'picture', '')
      from jsonb_array_elements(coalesce(u.identities, '[]'::jsonb)) as elem
      where elem ->> 'provider' = 'google'
      limit 1
    ) as avatar
  from auth.users u
) src
where src.id = p.id
  and src.avatar is not null
  and (
    p.avatar_url is null
    or p.avatar_url = ''
    or p.avatar_url like '%platform-lookaside.fbsbx.com%'
  );
