-- =============================================================================
-- IslaPabili MVP v1.0 - 0004: Storage buckets + RLS
-- Avatars public; onboarding docs, receipts, proofs private.
-- Object paths are namespaced by bucket/folder/<user-id>/<file>.
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('onboarding-docs', 'onboarding-docs', false),
  ('receipts', 'receipts', false),
  ('proofs', 'proofs', false)
on conflict (id) do nothing;

-- avatars (public browse, write own folder) ----------------------------------

create policy "avatars public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'avatars');

create policy "avatars insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "avatars update own"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and owner_id = auth.uid()::text)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "avatars delete own"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and owner_id = auth.uid()::text);

-- onboarding-docs (private; owner read/write, admin read) ---------------------

create policy "onboarding docs read"
on storage.objects for select
to authenticated
using (bucket_id = 'onboarding-docs' and (owner_id = auth.uid()::text or public.is_admin()));

create policy "onboarding docs insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'onboarding-docs'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = 'onboarding-docs'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "onboarding docs update"
on storage.objects for update
to authenticated
using (bucket_id = 'onboarding-docs' and owner_id = auth.uid()::text)
with check (
  bucket_id = 'onboarding-docs'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = 'onboarding-docs'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "onboarding docs delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'onboarding-docs' and (owner_id = auth.uid()::text or public.is_admin()));

-- receipts / proofs (private; service role only for now, opened when order
-- lifecycle ships in M5) -------------------------------------------------------

create policy "receipts service only"
on storage.objects for select
to service_role
using (bucket_id = 'receipts');

create policy "proofs service only"
on storage.objects for select
to service_role
using (bucket_id = 'proofs');