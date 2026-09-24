-- =============================================================================
-- IslaPabili MVP v1.0 - 0005: Rider role promotion + function grants
-- When an admin approves a rider application, the profile role flips to
-- 'rider' automatically. Also tightens EXECUTE grants used by policies/triggers.
-- =============================================================================

create or replace function public.on_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
    update public.profiles
    set role = 'rider'
    where id = new.rider_id;
  end if;
  return new;
end;
$$;

create trigger trg_rider_applications_role
after update of status on public.rider_applications
for each row execute function public.on_application_status_change();

-- EXPLICIT EXECUTE GRANTS -----------------------------------------------------
-- Supabase defaults may not grant access to these in every context; make the
-- grants deterministic so RLS policies and triggers work for every role.

grant execute on function public.app_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.set_updated_at() to anon, authenticated;
grant execute on function public.assign_order_number() to anon, authenticated;
grant execute on function public.on_application_status_change() to anon, authenticated;