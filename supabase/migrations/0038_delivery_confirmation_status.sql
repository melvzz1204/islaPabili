-- =============================================================================
-- IslaPabili MVP v1.0 - 0038: delivery-confirmation status value
--
-- Adds the `delivered` value to order_status: rider says "nadala ko na",
-- customer taps "natanggap ko na" to reach `completed`. Kept in its own
-- migration because Postgres cannot use a newly-added enum value in the
-- same transaction that adds it; 0039 wires the flow.
-- =============================================================================

alter type public.order_status add value if not exists 'delivered';
