-- =============================================================================
-- IslaPabili MVP v1.0 - Seed data (reference/dev only)
-- Idempotent-ish: safe to run via `supabase db <push|reset>` on a fresh DB.
-- =============================================================================

-- Default pricing engine (base fare / per-km / volume tiers) ------------------

insert into public.fare_config (name, base_fare, base_km, per_km_rate, volume_tiers, peak_surge, is_active)
values (
  'Default (v1)',
  40.00,
  2.00,
  10.00,
  '[
    {"min_items": 0, "min_weight_kg": 0, "surcharge": 0},
    {"min_items": 6, "min_weight_kg": 5, "surcharge": 20},
    {"min_items": 12, "min_weight_kg": 10, "surcharge": 40}
  ]'::jsonb,
  '{}'::jsonb,
  true
);

-- Sample merchant catalog (Boac, Marinduque) ----------------------------------

insert into public.merchants (name, category, town, address, lat, lng, phone, is_active)
values
  ('Jollibee Boac', 'fast_food', 'boac', 'M. P. Roxas St., Boac, Marinduque', 13.4490, 121.8395, null, true),
  ('McDonald''s Boac', 'fast_food', 'boac', 'San Isidro, Boac, Marinduque', 13.4462, 121.8390, null, true),
  ('GoodChow Boac', 'fast_food', 'boac', 'Gateway Center, Boac, Marinduque', 13.4480, 121.8372, null, true),
  ('Puregold Marinduque', 'grocery', 'boac', 'Bongabong Rd., Boac, Marinduque', 13.4420, 121.8440, null, true),
  ('Dali Boac', 'grocery', 'boac', 'Gov. Avila St., Boac, Marinduque', 13.4470, 121.8388, null, true),
  ('Mercury Drug Boac', 'drugstore', 'boac', 'M. P. Roxas St., Boac, Marinduque', 13.4492, 121.8398, null, true),
  ('Watsons Boac', 'drugstore', 'boac', 'M. P. Roxas St., Boac, Marinduque', 13.4487, 121.8392, null, true),
  ('Boac Public Market', 'local', 'boac', 'Boac, Marinduque', 13.4485, 121.8385, null, true);

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