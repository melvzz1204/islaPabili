-- =============================================================================
-- IslaPabili MVP v1.0 - 0049: restore the Jollibee menu onto the registered store
--
-- What happened: the seed flagship row (1111…, re-seeded Sep 27) and the
-- real registered "Jollibee Boac" store (approved Sep 24) are BOTH active.
-- fetchJollibeeMerchant() resolves the OLDEST active Jollibee-named row —
-- the registered store, which has ZERO products — so JollibeeMenuScreen
-- shows "No products yet" while the 14 seed products sit unreachable.
-- 0040's retire-seed guard ran before the registered store went live, so it
-- never fired.
--
-- Fix (idempotent, history-safe):
--   1. Copy the seed catalog onto the registered store, but ONLY when the
--      registered store has no products yet (re-runs never duplicate).
--   2. Deactivate the seed row (same guard as 0040). Seed rows are NOT
--      deleted: past orders keep their references; RLS hides their products
--      automatically once the merchant is inactive.
-- Jollibee stays rider-delivery-only (app layer, unchanged).
-- =============================================================================

-- 1. Seed catalog -> registered store (only when it has none) -----------------

insert into public.products (merchant_id, category, name, description, price, stock, unit, photo_url, is_active)
select
  reg.id,
  s.category,
  s.name,
  s.description,
  s.price,
  s.stock,
  s.unit,
  s.photo_url,
  s.is_active
from public.products s
join public.merchants seed
  on seed.id = '11111111-1111-4111-8111-111111111111'
cross join lateral (
  select m.id
  from public.merchants m
  where m.id <> '11111111-1111-4111-8111-111111111111'
    and m.is_active
    and m.name ilike '%jollibee%'
  order by m.created_at asc
  limit 1
) reg
where s.merchant_id = '11111111-1111-4111-8111-111111111111'
  and not exists (
    select 1 from public.products p where p.merchant_id = reg.id
  );

-- 2. Retire the seed row now that a live registered store carries the menu ---
-- (Same guard as 0040; fires now because the registered store is active.)

update public.merchants
set is_active = false, updated_at = now()
where id = '11111111-1111-4111-8111-111111111111'
  and is_active is distinct from false
  and exists (
    select 1 from public.merchants m
    where m.id <> '11111111-1111-4111-8111-111111111111'
      and m.is_active
      and m.name ilike '%jollibee%'
  );
