-- IslaPabili MVP v1.0 - 0035: users can clear their own notifications
--
-- The bell inbox "Clear" action deletes every row for the signed-in user.
-- Reads/writes stay owner-scoped; service_role keeps full access.

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
on public.notifications
for delete to authenticated
using (user_id = auth.uid());

grant delete on public.notifications to authenticated;
