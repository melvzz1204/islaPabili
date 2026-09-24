-- =============================================================================
-- IslaPabili MVP v1.0 - 0006: fix profiles RLS recursion
-- profiles_update_own's WITH CHECK read back into profiles, which made Postgres
-- re-evaluate the profiles SELECT policy from inside a profiles policy
-- ("infinite recursion detected in policy for relation profiles").
-- Replace that self-referential lookup with a SECURITY DEFINER helper that runs
-- as the table owner and therefore never re-enters RLS.
-- =============================================================================

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.my_role());

-- Explicit grant for the new definer function so the "check function privileges"
-- lint stays quiet (mirrors app_role/is_admin grants in 0005).
grant execute on function public.my_role() to anon, authenticated;