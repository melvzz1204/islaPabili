-- =============================================================================
-- IslaPabili MVP v1.0 - 0025: Rider card for customers + live duty count
--
-- When a rider accepts, the customer gets an Angkas-style rider card
-- (photo, name, contact, verified-license badge). Two reads were missing:
--   1. rider_applications of the assigned rider (photo + experience).
--      Limited to counterparties on a live/completed order, mirroring the
--      profiles_select pattern. The app only displays the photo, years and
--      verified status — never the raw license document.
--   2. That rider's profile photo file in onboarding-docs
--      (onboarding-docs/<rider-id>/selfie.jpg), same counterparty scope.
-- Plus rider_status on the realtime publication so the finding screen can
-- show a live on-duty count.
-- =============================================================================

-- Assigned rider's application visible to their customer -----------------------

drop policy if exists "applications_select_customer" on public.rider_applications;
create policy "applications_select_customer"
on public.rider_applications
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.rider_id = rider_applications.rider_id
    and o.customer_id = auth.uid()
    and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'completed')
));

-- Assigned rider's profile photo file visible to their customer ----------------

drop policy if exists "rider photo customer read" on storage.objects;
create policy "rider photo customer read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'onboarding-docs'
  and (storage.foldername(name))[3] = 'selfie.jpg'
  and exists (
    select 1 from public.orders o
    where o.customer_id = auth.uid()
      and o.rider_id::text = (storage.foldername(name))[2]
      and o.status in ('rider_assigned', 'items_purchased', 'in_transit', 'completed')
  )
);

-- Realtime for the live on-duty count ------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rider_status'
  ) then
    alter publication supabase_realtime add table public.rider_status;
  end if;
end
$$;
