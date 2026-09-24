-- =============================================================================
-- IslaPabili MVP v1.0 - 0002: Row Level Security
-- RLS enabled on every table. Role resolution via JWT app_role claim with a
-- database fallback (so policies work before the access-token hook is deployed).
-- =============================================================================

-- Role helpers ----------------------------------------------------------------

-- Current session role: JWT claim (custom access token hook, set by identity
-- metadata) falling back to the profiles table.
create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'app_role', '')::public.user_role,
    (select p.role from public.profiles p where p.id = auth.uid())
  );
$$;

-- Admin check (security definer so it sees profiles regardless of caller RLS).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Grants ----------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant usage on sequence public.order_seq to anon, authenticated, service_role;

grant select on public.merchants to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant insert, update, delete on public.merchants to authenticated;
grant all on all tables in schema public to service_role;

-- Risks accepted at RLS layer: DELETE grants exist but are blocked by the
-- absence of delete policies. All destructive writes require an explicit policy.

-- =============================================================================
-- profiles
-- =============================================================================
alter table public.profiles enable row level security;

-- Own profile, admins, or counterparties on an active/completed order
-- (customer reads assigned rider details; rider reads customer delivery info).
create policy "profiles_select"
on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.rider_id = public.profiles.id
      and o.customer_id = auth.uid()
      and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'completed')
  )
  or exists (
    select 1 from public.orders o
    where o.customer_id = public.profiles.id
      and o.rider_id = auth.uid()
      and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'completed')
  )
);

create policy "profiles_insert_own"
on public.profiles
for insert to authenticated
with check (id = auth.uid() and role = 'customer');

create policy "profiles_update_own"
on public.profiles
for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (select p.role from public.profiles p where p.id = auth.uid())
);

create policy "profiles_admin_update"
on public.profiles
for update to authenticated
using (public.is_admin());

-- =============================================================================
-- merchants
-- Catalog is public-readable; write access is admin-only.
-- =============================================================================
alter table public.merchants enable row level security;

create policy "merchants_select"
on public.merchants
for select to anon, authenticated
using (true);

create policy "merchants_admin_insert"
on public.merchants
for insert to authenticated
with check (public.is_admin());

create policy "merchants_admin_update"
on public.merchants
for update to authenticated
using (public.is_admin());

create policy "merchants_admin_delete"
on public.merchants
for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- vouchers
-- =============================================================================
alter table public.vouchers enable row level security;

create policy "vouchers_select"
on public.vouchers
for select to authenticated
using (true);

create policy "vouchers_admin_insert"
on public.vouchers
for insert to authenticated
with check (public.is_admin());

create policy "vouchers_admin_update"
on public.vouchers
for update to authenticated
using (public.is_admin());

create policy "vouchers_admin_delete"
on public.vouchers
for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- orders
-- NOTE: allowed state transitions are enforced by the dispatch/lifecycle Edge
-- functions; RLS here guards ownership, not transition validity.
-- =============================================================================
alter table public.orders enable row level security;

create policy "orders_select_participant"
on public.orders
for select to authenticated
using (customer_id = auth.uid() or rider_id = auth.uid() or public.is_admin());

create policy "orders_insert_customer"
on public.orders
for insert to authenticated
with check (customer_id = auth.uid());

create policy "orders_update_customer_pending"
on public.orders
for update to authenticated
using (customer_id = auth.uid() and status = 'pending_dispatch')
with check (customer_id = auth.uid() and status in ('pending_dispatch', 'cancelled'));

create policy "orders_update_rider_assigned"
on public.orders
for update to authenticated
using (rider_id = auth.uid())
with check (rider_id = auth.uid());

create policy "orders_update_admin"
on public.orders
for update to authenticated
using (public.is_admin());

-- =============================================================================
-- order_items
-- Owner edits while dispatch is still pending; participants/admin read.
-- =============================================================================
alter table public.order_items enable row level security;

create policy "order_items_select"
on public.order_items
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and (o.customer_id = auth.uid() or o.rider_id = auth.uid() or public.is_admin())
));

create policy "order_items_insert_owner"
on public.order_items
for insert to authenticated
with check (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.customer_id = auth.uid()
    and o.status = 'pending_dispatch'
));

create policy "order_items_update_owner"
on public.order_items
for update to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.customer_id = auth.uid()
    and o.status = 'pending_dispatch'
))
with check (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.customer_id = auth.uid()
));

create policy "order_items_delete_owner"
on public.order_items
for delete to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.customer_id = auth.uid()
    and o.status = 'pending_dispatch'
));

-- =============================================================================
-- order_status_log (immutable audit trail)
-- =============================================================================
alter table public.order_status_log enable row level security;

create policy "status_log_select"
on public.order_status_log
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_status_log.order_id
    and (o.customer_id = auth.uid() or o.rider_id = auth.uid() or public.is_admin())
));

create policy "status_log_insert"
on public.order_status_log
for insert to authenticated
with check (
  (actor_id = auth.uid() or public.is_admin())
  and exists (
    select 1 from public.orders o
    where o.id = order_status_log.order_id
      and (o.customer_id = auth.uid() or o.rider_id = auth.uid() or public.is_admin())
  )
);

-- =============================================================================
-- order_requests
-- Insert/expire via Edge Function (service role). Riders accept/decline own
-- pending requests only.
-- =============================================================================
alter table public.order_requests enable row level security;

create policy "order_requests_select_rider"
on public.order_requests
for select to authenticated
using (rider_id = auth.uid() or public.is_admin());

create policy "order_requests_update_rider"
on public.order_requests
for update to authenticated
using (rider_id = auth.uid() and status = 'pending')
with check (rider_id = auth.uid() and status in ('accepted', 'declined'));

-- =============================================================================
-- rider_status (fleet availability)
-- =============================================================================
alter table public.rider_status enable row level security;

create policy "rider_status_select"
on public.rider_status
for select to authenticated
using (true);

create policy "rider_status_insert_own"
on public.rider_status
for insert to authenticated
with check (rider_id = auth.uid());

create policy "rider_status_update_own"
on public.rider_status
for update to authenticated
using (rider_id = auth.uid())
with check (rider_id = auth.uid());

-- =============================================================================
-- rider_locations
-- Readable only by the rider, the customer on their active order, or admin.
-- Insert is rider-owned (throttled client heartbeat); pruning via scheduled job.
-- =============================================================================
alter table public.rider_locations enable row level security;

create policy "rider_locations_select_tracking"
on public.rider_locations
for select to authenticated
using (
  rider_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.rider_id = rider_locations.rider_id
      and o.customer_id = auth.uid()
      and o.status in ('rider_assigned', 'items_purchased', 'in_transit')
  )
);

create policy "rider_locations_insert_own"
on public.rider_locations
for insert to authenticated
with check (rider_id = auth.uid());

-- =============================================================================
-- rider_applications
-- Owner edits are locked once the application is no longer pending.
-- =============================================================================
alter table public.rider_applications enable row level security;

create policy "applications_select"
on public.rider_applications
for select to authenticated
using (rider_id = auth.uid() or public.is_admin());

create policy "applications_insert_own"
on public.rider_applications
for insert to authenticated
with check (rider_id = auth.uid());

create policy "applications_update_own_pending"
on public.rider_applications
for update to authenticated
using (rider_id = auth.uid() and status = 'pending')
with check (rider_id = auth.uid() and status = 'pending');

create policy "applications_admin_update"
on public.rider_applications
for update to authenticated
using (public.is_admin());

-- =============================================================================
-- transactions / wallets
-- Writes are edge-function (service role) only; RLS is read-only for riders.
-- =============================================================================
alter table public.transactions enable row level security;

create policy "transactions_select"
on public.transactions
for select to authenticated
using (rider_id = auth.uid() or public.is_admin());

alter table public.wallets enable row level security;

create policy "wallets_select"
on public.wallets
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- =============================================================================
-- ratings
-- =============================================================================
alter table public.ratings enable row level security;

create policy "ratings_select"
on public.ratings
for select to authenticated
using (customer_id = auth.uid() or rider_id = auth.uid() or public.is_admin());

create policy "ratings_insert_customer"
on public.ratings
for insert to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = ratings.order_id
      and o.customer_id = auth.uid()
      and o.status = 'completed'
  )
);

create policy "ratings_update_author"
on public.ratings
for update to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

create policy "ratings_admin_delete"
on public.ratings
for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- fare_config
-- =============================================================================
alter table public.fare_config enable row level security;

create policy "fare_config_select"
on public.fare_config
for select to authenticated
using (true);

create policy "fare_config_admin_insert"
on public.fare_config
for insert to authenticated
with check (public.is_admin());

create policy "fare_config_admin_update"
on public.fare_config
for update to authenticated
using (public.is_admin());