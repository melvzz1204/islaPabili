-- =============================================================================
-- IslaPabili MVP v1.0 - 0013: merchant-prepared order lifecycle states
-- Standalone migration: new enum values cannot be used in the same
-- transaction that adds them, so 0014 (columns/policies using them) ships
-- separately.
--
--   awaiting_merchant  order placed, merchant has not accepted yet
--   preparing          merchant accepted, packing the order
--   ready              packed; awaiting rider pickup or customer pickup
--   declined           merchant is too busy; customer picks fallback
-- =============================================================================

alter type public.order_status add value 'awaiting_merchant';
alter type public.order_status add value 'preparing';
alter type public.order_status add value 'ready';
alter type public.order_status add value 'declined';
