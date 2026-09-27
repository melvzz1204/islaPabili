-- =============================================================================
-- IslaPabili MVP v1.0 - 0011: merchant role
-- Merchant/store-owner accounts are distinct from customer/rider accounts.
-- Standalone migration: Postgres cannot use a newly added enum value in the
-- same transaction that adds it, so tables/policies that reference
-- 'merchant' live in 0012 (committed separately).
-- =============================================================================

alter type public.user_role add value 'merchant';
