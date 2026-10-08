-- =============================================================================
-- IslaPabili MVP v1.0 - Seed data (reference/dev only)
-- Idempotent-ish: safe to run via `supabase db <push|reset>` on a fresh DB.
-- =============================================================================

-- Default pricing engine (base fare / per-km / volume tiers) ------------------

insert into public.fare_config (name, base_fare, base_km, per_km_rate, volume_tiers, peak_surge, is_active)
values (
  'Default (v2)',
  45.00,
  2.00,
  15.00,
  '[]'::jsonb,
  '{}'::jsonb,
  true
);

-- NOTE: no demo merchants are seeded. Only merchants approved through the
-- merchant application flow appear in the Shop (Jollibee included — the
-- registered store keeps its own id; see migration 0040).

-- -----------------------------------------------------------------------------
-- DEMO ADMIN NOTE
-- Profiles are created automatically when an auth user signs up (role:
-- customer). To promote the first superadmin, create the account via the
-- Supabase Auth UI / client, then run:
--
--   update public.profiles
--   set role = 'admin'
--   where id = (select id from auth.users where email = 'admin@islapabili.ph');
-- -----------------------------------------------------------------------------