-- =============================================================================
-- IslaPabili MVP v1.0 - 0019: Rider review + rejection notifications
-- Two things the admin console needs that did not exist:
--   1. Deciding an application must always notify the rider, and a rejection
--      must carry a reason the rider can read and act on.
--   2. A single server-side entry point for a decision, so the reason is
--      enforced, reviewed_by/reviewed_at are stamped, and the rider is notified
--      in the same transaction as the status change.
-- =============================================================================

-- Role promotion + rider notification on every status change. security definer
-- so the notification insert is not subject to notifications RLS.
create or replace function public.on_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  v_towns text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'approved' then
    update public.profiles
    set role = 'rider'
    where id = new.rider_id;

    v_towns := coalesce(
      (select string_agg(t::text, ', ')
         from unnest(new.operating_towns) as t),
      ''
    );
    v_title := 'Rider application approved';
    v_body := 'Welcome to IslaPabili! You are cleared to go on duty'
      || case when v_towns <> '' then ' for ' || v_towns || '.' else '.' end
      || ' Tap Go on duty from the Rider tab when you are ready.';
  elsif new.status = 'rejected' then
    v_title := 'Rider application not approved';
    v_body := coalesce(
      nullif(btrim(new.admin_notes), ''),
      'Please contact IslaPabili support for details.'
    );
  else
    return new;
  end if;

  insert into public.notifications (user_id, title, body)
  values (new.rider_id, v_title, v_body);

  return new;
end;
$$;

-- Single entry point for an admin decision. Rejecting without a reason is
-- refused here rather than trusted to the client.
create or replace function public.review_rider_application(
  p_application_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.rider_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rider_applications;
  v_reason text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can review rider applications'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected, got %', p_decision
      using errcode = '22023';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if p_decision = 'rejected' and v_reason is null then
    raise exception 'A reason is required when rejecting a rider application'
      using errcode = '22023';
  end if;

  update public.rider_applications
  set
    status = p_decision::public.approval_status,
    admin_notes = v_reason,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_application_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Rider application % not found', p_application_id
      using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

grant execute on function public.review_rider_application(uuid, text, text) to authenticated;
grant execute on function public.on_application_status_change() to anon, authenticated;

-- A rejection must always have a reason attached, whichever code path wrote it.
-- Backfill first so the constraint cannot fail on rows that predate this rule.
update public.rider_applications
set admin_notes = 'Please contact IslaPabili support for details.'
where status = 'rejected'
  and length(btrim(coalesce(admin_notes, ''))) = 0;

alter table public.rider_applications
  drop constraint if exists rider_applications_rejection_reason_check;

alter table public.rider_applications
  add constraint rider_applications_rejection_reason_check
  check (status <> 'rejected' or length(btrim(coalesce(admin_notes, ''))) > 0);
