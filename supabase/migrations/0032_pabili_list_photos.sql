-- IslaPabili MVP v1.0 - 0032: Pabili list photos (paper-list snapshots)
--
-- Customers attach up to a few photos of a handwritten pabili list (or shelf
-- items) from the Add-items modal. Paths live on orders.list_photo_urls; the
-- assigned rider (and the customer) can read them, nobody else can.

alter table public.orders
  add column if not exists list_photo_urls text[] not null default '{}';

-- Private bucket, 5 MB per photo, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pabili-lists', 'pabili-lists', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Writes are owner-scoped: pabili-lists/<uid>/<file>.
drop policy if exists "pabili lists owner insert" on storage.objects;
create policy "pabili lists owner insert"
on storage.objects for insert
with check (
  bucket_id = 'pabili-lists'
  and (storage.foldername(name))[1] = 'pabili-lists'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "pabili lists owner update" on storage.objects;
create policy "pabili lists owner update"
on storage.objects for update
using (bucket_id = 'pabili-lists' and owner_id = auth.uid()::text)
with check (
  bucket_id = 'pabili-lists'
  and (storage.foldername(name))[1] = 'pabili-lists'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "pabili lists owner delete" on storage.objects;
create policy "pabili lists owner delete"
on storage.objects for delete
using (bucket_id = 'pabili-lists' and owner_id = auth.uid()::text);

-- Reads: the uploader, admins, and whichever customer/rider belong to an
-- order that references the object path.
drop policy if exists "pabili lists party read" on storage.objects;
create policy "pabili lists party read"
on storage.objects for select
using (
  bucket_id = 'pabili-lists'
  and (
    owner_id = auth.uid()::text
    or public.is_admin()
    or exists (
      select 1
      from public.orders o
      where name = any (o.list_photo_urls)
        and (o.customer_id = auth.uid() or o.rider_id = auth.uid())
    )
  )
);
