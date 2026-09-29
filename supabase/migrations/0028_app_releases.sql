-- =============================================================================
-- IslaPabili MVP v1.0 - 0028: App releases (in-app update prompts)
--
-- The admin console publishes one row per shipped build with release notes
-- and a download URL. The mobile app compares its native build number and
-- shows a real-app style "What's new / Update now" sheet; builds below
-- min_build cannot be dismissed.
-- =============================================================================

create table public.app_releases (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'android' check (platform in ('android', 'ios')),
  version text not null default '0.1.0',
  build_number integer not null,
  notes text not null default '',
  apk_url text,
  min_build integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index app_releases_platform_idx on public.app_releases (platform, is_active, build_number desc);

alter table public.app_releases enable row level security;

-- Readable before login: the update check runs on cold start.
create policy "app_releases_select"
on public.app_releases
for select to anon, authenticated
using (true);

create policy "app_releases_admin_insert"
on public.app_releases
for insert to authenticated
with check (public.is_admin());

create policy "app_releases_admin_update"
on public.app_releases
for update to authenticated
using (public.is_admin());

create policy "app_releases_admin_delete"
on public.app_releases
for delete to authenticated
using (public.is_admin());

grant select on public.app_releases to anon;
grant select, insert, update, delete on public.app_releases to authenticated;
grant all on public.app_releases to service_role;

-- Baseline: matches the first preview builds (version 0.1.0, code 1).
insert into public.app_releases (platform, version, build_number, notes, min_build, is_active)
values ('android', '0.1.0', 1, 'Initial preview build.', 0, true);
