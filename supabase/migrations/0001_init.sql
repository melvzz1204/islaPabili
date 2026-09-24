-- =============================================================================
-- IslaPabili MVP v1.0 - 0001: Schema foundation
-- Enums, tables, helper functions & triggers. RLS is applied in 0002.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'rider', 'admin');
create type public.island_town as enum ('boac', 'gasan', 'mogpog', 'santa_cruz', 'torrijos', 'buenavista');
create type public.merchant_category as enum ('fast_food', 'grocery', 'drugstore', 'local');
create type public.order_status as enum ('pending_dispatch', 'rider_assigned', 'items_purchased', 'in_transit', 'completed', 'cancelled', 'failed');
create type public.request_status as enum ('pending', 'accepted', 'declined', 'expired');
create type public.payment_method as enum ('cod', 'ewallet');
create type public.transaction_kind as enum ('cod_collected', 'ewallet_paid', 'commission', 'tip', 'cashout', 'adjustment');
create type public.transaction_status as enum ('pending', 'settled', 'failed', 'refunded');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.voucher_discount_type as enum ('fixed', 'percent');

-- ---------------------------------------------------------------------------
-- profiles
-- Mirrors auth.users; row created automatically by handle_new_user() trigger.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  email text,
  full_name text not null default '',
  phone text,
  avatar_url text,
  home_town public.island_town,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_key unique (phone)
);

create index profiles_role_idx on public.profiles (role);
create index profiles_home_town_idx on public.profiles (home_town);

-- ---------------------------------------------------------------------------
-- merchants
-- Curated outlet catalog (fast food, grocery, drugstore, local).
-- ---------------------------------------------------------------------------
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.merchant_category not null,
  town public.island_town not null,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index merchants_town_category_idx on public.merchants (town, category, is_active);

-- ---------------------------------------------------------------------------
-- vouchers
-- Promo discount codes.
-- ---------------------------------------------------------------------------
create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  discount_type public.voucher_discount_type not null,
  value numeric(12,2) not null check (value > 0),
  max_discount numeric(12,2),
  min_spend numeric(12,2) not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  town public.island_town,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vouchers_town_active_idx on public.vouchers (town, is_active, valid_until);

-- ---------------------------------------------------------------------------
-- orders
-- Denormalized fare breakdown snapshot for transparent, tamper-proof quoting.
-- ---------------------------------------------------------------------------
create sequence public.order_seq start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rider_id uuid references public.profiles (id) on delete set null,
  status public.order_status not null default 'pending_dispatch',
  town public.island_town not null,
  is_custom_list boolean not null default false,
  merchant_id uuid references public.merchants (id) on delete set null,
  pickup_name text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_address text not null default '',
  dropoff_notes text,
  distance_km numeric(6,2),
  base_fare numeric(12,2) not null default 0,
  per_km_rate numeric(12,2) not null default 0,
  distance_fee numeric(12,2) not null default 0,
  volume_surcharge numeric(12,2) not null default 0,
  total_delivery_fee numeric(12,2) not null default 0,
  est_items_total numeric(12,2) not null default 0,
  voucher_id uuid references public.vouchers (id) on delete set null,
  discount_amount numeric(12,2) not null default 0,
  tip_amount numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  payment_method public.payment_method not null default 'cod',
  is_paid boolean not null default false,
  rider_earnings_estimate numeric(12,2) not null default 0,
  accepted_at timestamptz,
  purchased_at timestamptz,
  in_transit_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_item_total_non_negative check (est_items_total >= 0),
  constraint orders_delivery_fee_non_negative check (total_delivery_fee >= 0)
);

-- ---------------------------------------------------------------------------
-- order_items
-- Merchant SKU lines (quantity) or custom checklist lines (free text).
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  name text not null,
  quantity integer not null check (quantity > 0),
  estimated_price numeric(12,2),
  store text,
  notes text,
  weight_kg numeric(6,2),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- order_status_log
-- Immutable audit trail of every order state transition.
-- ---------------------------------------------------------------------------
create table public.order_status_log (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  actor_role public.user_role,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- order_requests
-- Dispatch queue. Inserts/expirations are driven by the dispatch Edge Function
-- (service role); riders only update their own request to accepted/declined.
-- ---------------------------------------------------------------------------
create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  status public.request_status not null default 'pending',
  expires_at timestamptz not null,
  responded_at timestamptz,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  constraint order_requests_order_rider_key unique (order_id, rider_id)
);

-- ---------------------------------------------------------------------------
-- rider_status
-- On-duty broadcast + fleet availability in a town (throttled heartbeat).
-- ---------------------------------------------------------------------------
create table public.rider_status (
  rider_id uuid primary key references public.profiles (id) on delete cascade,
  on_duty boolean not null default false,
  current_town public.island_town,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rider_locations
-- Durable, throttled location snapshots for tracking/replay. High-frequency
-- ticks travel over Realtime broadcast, NOT this table (see M6 plan).
-- ---------------------------------------------------------------------------
create table public.rider_locations (
  id bigint generated always as identity primary key,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rider_applications
-- Onboarding compliance documents + approval workflow.
-- ---------------------------------------------------------------------------
create table public.rider_applications (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null unique references public.profiles (id) on delete cascade,
  driver_license_url text,
  vehicle_registration_url text,
  vehicle_photo_url text,
  rider_photo_url text,
  helmet_photo_url text,
  bg_clearance_url text,
  driving_experience_years integer check (driving_experience_years >= 0),
  status public.approval_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- transactions / wallets
-- Rider settlement bookkeeping (COD collections, e-wallet, commissions, payouts).
-- wallet updates happen in Edge Functions only (service role / RPC).
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete set null,
  rider_id uuid references public.profiles (id) on delete set null,
  kind public.transaction_kind not null,
  amount numeric(12,2) not null check (amount > 0),
  status public.transaction_status not null default 'pending',
  method public.payment_method,
  reference text,
  created_at timestamptz not null default now()
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  cash_on_hand numeric(12,2) not null default 0 check (cash_on_hand >= 0),
  payout_balance numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ratings
-- Post-delivery 5-star + text/photo review.
-- ---------------------------------------------------------------------------
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  comment text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- fare_config
-- Dynamic pricing engine: base fare, per-km rate, volume tiers, peak surge.
-- volume_tiers example: [{"min_items":0,"min_weight_kg":0,"surcharge":0}, ...]
-- ---------------------------------------------------------------------------
create table public.fare_config (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Default',
  base_fare numeric(12,2) not null default 40,
  base_km numeric(5,2) not null default 2.00,
  per_km_rate numeric(12,2) not null default 10,
  volume_tiers jsonb not null default '[]'::jsonb,
  peak_surge jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions & triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_merchants_updated_at before update on public.merchants for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger trg_rider_applications_updated_at before update on public.rider_applications for each row execute function public.set_updated_at();
create trigger trg_wallets_updated_at before update on public.wallets for each row execute function public.set_updated_at();
create trigger trg_vouchers_updated_at before update on public.vouchers for each row execute function public.set_updated_at();
create trigger trg_fare_config_updated_at before update on public.fare_config for each row execute function public.set_updated_at();

-- Human-readable order number: IP-YYYYMMDD-NNNN
create or replace function public.assign_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null then
    new.order_number := 'IP-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.order_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_orders_assign_number before insert on public.orders
for each row execute function public.assign_order_number();

-- Auto-create a profile (role: customer) whenever an auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();