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

-- Jollibee Boac (flagship merchant) -------------------------------------------
-- Fixed UUID so products can link reliably + reseeds stay idempotent.

insert into public.merchants (id, name, category, town, address, lat, lng, phone, is_active)
values
  ('11111111-1111-4111-8111-111111111111', 'Jollibee Boac', 'fast_food', 'boac', 'M. P. Roxas St., Boac, Marinduque', 13.4490, 121.8395, null, true)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  town = excluded.town,
  address = excluded.address,
  lat = excluded.lat,
  lng = excluded.lng,
  is_active = excluded.is_active,
  updated_at = now();

-- Jollibee Boac menu (dev reference; merchant adjusts live prices/stock) -----
-- Photos: free Unsplash images (hotlinked). Each URL was visually checked to
-- match the item. For production, upload own shots to the product-photos
-- bucket and store the path instead.

insert into public.products (id, merchant_id, category, name, description, price, stock, unit, photo_url, is_active)
values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-111111111111', 'Chickenjoy', '1-pc. Chickenjoy Solo', 'Crispylicious fried chicken with steamed rice and gravy.', 106.00, 100, 'pc', 'https://images.unsplash.com/photo-1579065497397-2824d41272ce?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-111111111111', 'Chickenjoy', '1-pc. Chickenjoy w/ Drink', '1-pc. Chickenjoy with rice and regular drink.', 136.00, 100, 'set', 'https://images.unsplash.com/photo-1566918214014-a3b3e0132267?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-111111111111', 'Chickenjoy', '2-pc. Chickenjoy Solo', 'Two pieces of Crispylicious chicken with 2 rice and gravy.', 211.00, 50, 'set', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000004', '11111111-1111-4111-8111-111111111111', 'Chickenjoy', '6-pc. Chickenjoy Bucket', 'Six pieces of Crispylicious chicken with gravy, for sharing.', 500.00, 20, 'bucket', 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000005', '11111111-1111-4111-8111-111111111111', 'Burgers', 'Yumburger Solo', 'Beefy patty with signature dressing in a soft bun.', 56.00, 100, 'pc', 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000006', '11111111-1111-4111-8111-111111111111', 'Burgers', 'Cheesy Yumburger Solo', 'Yumburger with a slice of cheese and signature dressing.', 93.00, 100, 'pc', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000007', '11111111-1111-4111-8111-111111111111', 'Burgers', 'Yumburger Meal', 'Yumburger with regular fries and regular drink.', 163.00, 80, 'set', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000008', '11111111-1111-4111-8111-111111111111', 'Spaghetti & Palabok', 'Jolly Spaghetti Solo', 'Sweet-style spaghetti with hotdog bits and grated cheese.', 85.00, 100, 'serving', 'https://images.unsplash.com/photo-1588013273468-315fd88ea34c?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000009', '11111111-1111-4111-8111-111111111111', 'Spaghetti & Palabok', 'Jolly Spaghetti w/ Yumburger + Drink', 'Jolly Spaghetti with Yumburger and regular drink.', 151.00, 80, 'set', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000010', '11111111-1111-4111-8111-111111111111', 'Spaghetti & Palabok', 'Palabok Solo', 'Rice noodles with shrimp sauce, chicharon, and boiled egg.', 163.00, 60, 'serving', 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000011', '11111111-1111-4111-8111-111111111111', 'Rice Meals', '1-pc. Burger Steak Solo', 'Beef patty with mushroom gravy over steamed rice.', 95.00, 100, 'pc', 'https://images.unsplash.com/photo-1723511413901-99439b957bbf?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000012', '11111111-1111-4111-8111-111111111111', 'Rice Meals', '1-pc. Burger Steak Meal', 'Burger steak with rice and regular drink.', 120.00, 80, 'set', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000013', '11111111-1111-4111-8111-111111111111', 'Sides', 'Jolly Crispy Fries (Regular)', 'Crispy golden fries, regular size.', 62.00, 120, 'pc', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80', true),
  ('22222222-2222-4222-8222-000000000014', '11111111-1111-4111-8111-111111111111', 'Desserts', 'Peach Mango Pie', 'Crispy fried pie with peach and real mango filling.', 57.00, 120, 'pc', 'https://images.unsplash.com/photo-1621743478914-cc8a86d7e7b5?auto=format&fit=crop&w=800&q=80', true)
on conflict (id) do update set
  merchant_id = excluded.merchant_id,
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  stock = excluded.stock,
  unit = excluded.unit,
  photo_url = excluded.photo_url,
  is_active = excluded.is_active,
  updated_at = now();

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