-- =============================================================================
-- IslaPabili MVP v1.0 - 0015: customer town preferences (multi-select)
--
-- Onboarding used to force a single home_town. Customers may now opt in to any
-- number of municipalities: town_preferences is the set of towns they want to
-- browse, and home_town stays the single town used for delivery addresses,
-- order town and rider positioning.
--
-- An empty town_preferences means "no towns chosen yet", so existing rows are
-- backfilled from home_town to preserve current behaviour.
-- =============================================================================

alter table public.profiles
  add column if not exists town_preferences public.island_town[] not null default '{}';

comment on column public.profiles.town_preferences is
  'Municipalities the customer opted into. Empty = none chosen yet; all towns = every value in island_town.';

-- Backfill existing customers from their single home town.
update public.profiles
set town_preferences = array[home_town]
where home_town is not null
  and cardinality(town_preferences) = 0;

create index if not exists profiles_town_preferences_idx
  on public.profiles using gin (town_preferences);
