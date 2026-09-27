-- =============================================================================
-- IslaPabili MVP v1.0 - 0012: merchant accounts, catalog & approval workflow
-- Distinct merchant accounts own stores and manage their product catalog.
-- Mirrors the rider_applications pattern: apply -> superadmin approves ->
-- store row + ownership link created, profile role flips to 'merchant'.
--
-- Tables:
--   merchant_applications  onboarding form + compliance docs + approval state
--   merchant_owners        profile <-> merchant links (assigned at approval)
--   products               per-merchant catalog (public read when active)
-- =============================================================================

-- Tables (created before helpers/policies that reference them) ----------------

create table public.merchant_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null unique references public.profiles (id) on delete cascade,
  store_name text not null,
  category public.merchant_category not null,
  town public.island_town not null,
  address text,
  phone text,
  business_permit_url text,
  store_photo_url text,
  status public.approval_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.merchant_owners (
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (merchant_id, profile_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  category text not null default 'General',
  name text not null,
  description text not null default '',
  price numeric(12,2) not null check (price > 0),
  stock integer not null default 0 check (stock >= 0),
  unit text not null default 'pc',
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_merchant_active_idx on public.products (merchant_id, is_active);
create index merchant_owners_profile_idx on public.merchant_owners (profile_id);

create trigger trg_merchant_applications_updated_at before update on public.merchant_applications
for each row execute function public.set_updated_at();

create trigger trg_products_updated_at before update on public.products
for each row execute function public.set_updated_at();

-- Ownership helper (after tables: SQL-language body plans at creation) --------

create or replace function public.is_merchant_owner(p_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.merchant_owners mo
    where mo.merchant_id = p_merchant_id
      and mo.profile_id = auth.uid()
  );
$$;

-- Approval trigger: approved application -> store + ownership + role ----------

create or replace function public.on_merchant_application_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant_id uuid;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into public.merchants (name, category, town, address, phone, is_active)
    values (new.store_name, new.category, new.town, new.address, new.phone, true)
    returning id into v_merchant_id;

    insert into public.merchant_owners (merchant_id, profile_id)
    values (v_merchant_id, new.applicant_id)
    on conflict do nothing;

    update public.profiles
    set role = 'merchant'
    where id = new.applicant_id;
  end if;
  return new;
end;
$$;

create trigger trg_merchant_applications_approval
after update of status on public.merchant_applications
for each row execute function public.on_merchant_application_approved();

-- Grants ----------------------------------------------------------------------

grant select on public.products to anon;
grant select, insert, update, delete
  on public.merchant_applications, public.merchant_owners, public.products
  to authenticated;
grant all
  on public.merchant_applications, public.merchant_owners, public.products
  to service_role;

grant execute on function public.is_merchant_owner(uuid) to anon, authenticated;
grant execute on function public.on_merchant_application_approved() to anon, authenticated;

-- RLS -------------------------------------------------------------------------

alter table public.merchant_applications enable row level security;
alter table public.merchant_owners enable row level security;
alter table public.products enable row level security;

-- merchant_applications: owner flow mirrors rider_applications ---------------

create policy "merchant_applications_select"
on public.merchant_applications
for select to authenticated
using (applicant_id = auth.uid() or public.is_admin());

create policy "merchant_applications_insert_own"
on public.merchant_applications
for insert to authenticated
with check (applicant_id = auth.uid());

create policy "merchant_applications_update_own_pending"
on public.merchant_applications
for update to authenticated
using (applicant_id = auth.uid() and status = 'pending')
with check (applicant_id = auth.uid() and status = 'pending');

create policy "merchant_applications_admin_update"
on public.merchant_applications
for update to authenticated
using (public.is_admin());

-- merchant_owners: read own links; assignment happens at approval (trigger) --

create policy "merchant_owners_select"
on public.merchant_owners
for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy "merchant_owners_admin_write"
on public.merchant_owners
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- products: public catalog read; owners manage own merchant's rows -----------

create policy "products_select_public"
on public.products
for select to anon, authenticated
using (
  is_active
  and exists (
    select 1 from public.merchants m
    where m.id = products.merchant_id and m.is_active
  )
);

create policy "products_owner_select"
on public.products
for select to authenticated
using (public.is_merchant_owner(merchant_id));

create policy "products_owner_insert"
on public.products
for insert to authenticated
with check (public.is_merchant_owner(merchant_id));

create policy "products_owner_update"
on public.products
for update to authenticated
using (public.is_merchant_owner(merchant_id))
with check (public.is_merchant_owner(merchant_id));

create policy "products_owner_delete"
on public.products
for delete to authenticated
using (public.is_merchant_owner(merchant_id));

create policy "products_admin_write"
on public.products
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- merchants: owners can edit their own storefront profile --------------------

create policy "merchants_owner_update"
on public.merchants
for update to authenticated
using (public.is_merchant_owner(id))
with check (public.is_merchant_owner(id));

-- Storage: product-photos (public catalog images, owner-scoped writes) -------

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "product photos public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-photos');

create policy "product photos owner insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-photos'
  and (storage.foldername(name))[1] = 'product-photos'
  and public.is_merchant_owner(((storage.foldername(name))[2])::uuid)
);

create policy "product photos owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-photos'
  and public.is_merchant_owner(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'product-photos'
  and (storage.foldername(name))[1] = 'product-photos'
  and public.is_merchant_owner(((storage.foldername(name))[2])::uuid)
);

create policy "product photos owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-photos'
  and (
    public.is_merchant_owner(((storage.foldername(name))[2])::uuid)
    or public.is_admin()
  )
);
