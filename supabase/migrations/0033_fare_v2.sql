-- IslaPabili MVP v1.0 - 0033: Fare v2 (transparent GPS pricing)
--
-- ₱45 base covers the first 2 km, then ₱15 per km on GPS distance.
-- Volume tiers and peak surge are cleared: no hidden charges, the receipt
-- is always exactly "base + per-km".

update public.fare_config set is_active = false where is_active = true;

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

alter table public.fare_config alter column base_fare set default 45;
alter table public.fare_config alter column per_km_rate set default 15;
