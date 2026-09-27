-- =============================================================================
-- IslaPabili MVP v1.0 - 0018: Driver's license front + back
-- Riders must submit both sides of the license, not just the front. The existing
-- single column is renamed rather than dropped and re-added so any document
-- already uploaded under it survives.
-- =============================================================================
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rider_applications'
      and column_name = 'driver_license_url'
  ) then
    alter table public.rider_applications
      rename column driver_license_url to driver_license_front_url;
  end if;
end
$$;

alter table public.rider_applications
  add column if not exists driver_license_back_url text;

comment on column public.rider_applications.driver_license_front_url is
  'Storage path to the front of the rider''s driver''s license.';
comment on column public.rider_applications.driver_license_back_url is
  'Storage path to the back of the rider''s driver''s license.';
