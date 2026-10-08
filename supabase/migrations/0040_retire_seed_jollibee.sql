-- =============================================================================
-- IslaPabili MVP v1.0 - 0040: retire the unregistered seed flagship row
--
-- The Shop lists only registered merchants. The hardcoded seed "Jollibee"
-- row (fixed UUID, no owner, no logo) is hidden — but ONLY when a real
-- registered Jollibee-named store is already live, so the storefront never
-- ends up with no Jollibee at all. Rows are NOT deleted: order history and
-- catalogs stay intact.
-- Idempotent: safe to re-run.
-- =============================================================================

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
