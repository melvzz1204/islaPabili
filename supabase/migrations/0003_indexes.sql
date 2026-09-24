-- =============================================================================
-- IslaPabili MVP v1.0 - 0003: Performance indexes
-- Adds query-path indexes (hot-path + admin reporting) on top of the
-- structural indexes already created inline in 0001_init.sql.
-- =============================================================================

-- Orders: hot paths -----------------------------------------------------------

-- Customer "my orders" list.
create index orders_customer_created_idx on public.orders (customer_id, created_at desc);

-- Rider "my jobs" + earnings dashboard.
create index orders_rider_created_idx on public.orders (rider_id, created_at desc);

-- Dispatch fan-out: open orders in a town, oldest first.
create index orders_status_town_created_idx on public.orders (status, town, created_at desc);

-- Order children --------------------------------------------------------------

create index order_items_order_idx on public.order_items (order_id);
create index order_status_log_order_created_idx on public.order_status_log (order_id, created_at);
create index transactions_order_idx on public.transactions (order_id);
create index ratings_rider_idx on public.ratings (rider_id);

-- Dispatch queue --------------------------------------------------------------

create index order_requests_order_status_idx on public.order_requests (order_id, status);
create index order_requests_rider_pending_idx on public.order_requests (rider_id, status, expires_at);

-- Location history (recent-first pruning + per-rider lookup) ------------------

create index rider_locations_rider_time_idx on public.rider_locations (rider_id, recorded_at desc);

-- Financials ------------------------------------------------------------------

create index transactions_rider_created_idx on public.transactions (rider_id, created_at desc);

-- Geo lookups -----------------------------------------------------------------

create index merchants_coords_idx on public.merchants (lat, lng);