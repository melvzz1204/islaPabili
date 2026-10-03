-- IslaPabili MVP v1.0 - 0034: super-admin moderation of pabili list photos
--
-- Admins can remove an abusive/wrong paper-list photo from the console:
-- the app detaches the path from the order, then deletes the object.

drop policy if exists "pabili lists owner delete" on storage.objects;
create policy "pabili lists owner delete"
on storage.objects for delete
using (
  bucket_id = 'pabili-lists'
  and (owner_id = auth.uid()::text or public.is_admin())
);
