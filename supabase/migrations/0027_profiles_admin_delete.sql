-- =============================================================================
-- IslaPabili MVP v1.0 - 0027: Admin profile deletion
--
-- Allows admins to hard-delete an account from the dashboard. Related rows
-- (orders, items, requests, messages, ratings, notifications, wallet,
-- applications) are removed by the ON DELETE CASCADE foreign keys; orders
-- where the account was only the rider are detached (SET NULL) instead.
-- NOTE: the auth.users login record is not removed by this policy — account
-- removal from the dashboard wipes the profile and all history, and the
-- orphaned login can no longer load a profile.
-- =============================================================================

create policy "profiles_admin_delete"
on public.profiles
for delete to authenticated
using (public.is_admin());
