-- =============================================================================
-- IslaPabili MVP v1.0 - 0029: Push tokens (server-side wake-up)
--
-- One Expo push token per account. The push-send edge function (service role)
-- reads these to deliver rider/customer alerts even when the app is killed.
-- =============================================================================

create table public.push_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own"
on public.push_tokens
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "push_tokens_upsert_own"
on public.push_tokens
for insert to authenticated
with check (user_id = auth.uid());

create policy "push_tokens_update_own"
on public.push_tokens
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_tokens_delete_own"
on public.push_tokens
for delete to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;
