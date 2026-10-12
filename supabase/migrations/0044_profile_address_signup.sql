-- =============================================================================
-- IslaPabili MVP v1.0 - 0044: carry signup address into profiles
--
-- RegisterScreen now collects an optional delivery address. signUpWithPassword
-- stores it in auth user_metadata; the on_auth_user_created trigger copies it
-- into profiles.address so checkout/pabili can offer "use my saved address".
--
-- NOTE: this is a full merge of all prior handle_new_user() logic — 0010
-- (username + synthetic-email nulling + phone + wallet), 0041/0042 (OAuth
-- avatar copy + Google-first repair). Earlier rewrites each dropped columns;
-- keep every field here when editing this function.
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
  insert into public.profiles (id, email, phone, full_name, username, avatar_url, address)
  values (
    new.id,
    v_email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    v_username,
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture',
        ''
      ),
      ''
    ),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'address', '')), '')
  );

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
