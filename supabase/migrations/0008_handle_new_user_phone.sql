-- =============================================================================
-- IslaPabili MVP v1.0 - 0008: phone-OTP signups
-- Users who sign up via SMS OTP have auth.users.phone set (and email null).
-- Carry the phone into the profile so onboarding can pre-fill it.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  );

  insert into public.wallets (user_id)
  values (new.id);

  return new;
end;
$$;