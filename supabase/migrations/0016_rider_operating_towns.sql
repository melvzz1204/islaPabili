-- =============================================================================
-- IslaPabili MVP v1.0 - 0016: rider operating area (multi-select)
--
-- A rider used to apply for exactly one town, which was written to
-- profiles.home_town — conflating "where you live" with "where you deliver".
-- Operating area is now its own set so a rider can cover several
-- municipalities, or the whole island, without losing their home town.
--
-- rider_status.current_town stays a single island_town: that is the rider's
-- physical position right now, which is genuinely one place at a time.
-- operating_towns is the area they are approved and willing to deliver in.
--
-- Empty means "not recorded yet", so existing rows are backfilled from the
-- single town they were operating in.
-- =============================================================================

alter table public.rider_applications
  add column if not exists operating_towns public.island_town[] not null default '{}';

comment on column public.rider_applications.operating_towns is
  'Municipalities the applicant will deliver in. All towns = every value in island_town.';

alter table public.rider_status
  add column if not exists operating_towns public.island_town[] not null default '{}';

comment on column public.rider_status.operating_towns is
  'Municipalities the rider currently delivers in. current_town stays their live position.';

-- Backfill from the town the rider was already pinned to.
update public.rider_applications
set operating_towns = array[r.home_town]
from public.profiles r
where r.id = rider_applications.rider_id
  and r.home_town is not null
  and cardinality(rider_applications.operating_towns) = 0;

update public.rider_status
set operating_towns = array[current_town]
where current_town is not null
  and cardinality(operating_towns) = 0;

create index if not exists rider_applications_operating_towns_idx
  on public.rider_applications using gin (operating_towns);

create index if not exists rider_status_operating_towns_idx
  on public.rider_status using gin (operating_towns);
