-- =============================================================================
-- IslaPabili MVP v1.0 - 0020: Rider application submission notification
--
-- Gap: submitting a rider application wrote no notification, so the bell
-- stayed empty and the rider had no inbox confirmation that the application
-- is pending review. Approvals/rejections already notify (0019, via the
-- trg_rider_applications_role trigger from 0005).
--
-- This adds:
--   1. notifications.kind — lets the app deep-link (order vs rider_application)
--      without parsing titles.
--   2. An AFTER INSERT trigger on rider_applications that confirms receipt
--      ("pending review") in the same transaction as the submission.
--   3. kind tagging on the approve/reject notifications from 0019.
-- =============================================================================

-- Notification kind -----------------------------------------------------------

alter table public.notifications
  add column if not exists kind text;

-- Existing rows: order-linked notifications are order notifications.
update public.notifications
set kind = 'order'
where kind is null and order_id is not null;

-- Past rider decisions (written by 0019 without a kind) get tagged too.
update public.notifications
set kind = 'rider_application'
where kind is null
  and order_id is null
  and title in ('Rider application approved', 'Rider application not approved');

-- Submission receipt ----------------------------------------------------------

create or replace function public.on_rider_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, body)
  values (
    new.rider_id,
    'rider_application',
    'Application received',
    'Your rider application was submitted and is pending review. '
      || 'This usually takes 1–2 business days — you will be notified here once an administrator approves it.'
  );
  return new;
end;
$$;

drop trigger if exists trg_rider_applications_submitted on public.rider_applications;
create trigger trg_rider_applications_submitted
after insert on public.rider_applications
for each row execute function public.on_rider_application_submitted();

grant execute on function public.on_rider_application_submitted() to anon, authenticated;

-- Tag approve/reject notifications so the app can deep-link them too ---------

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

  insert into public.notifications (user_id, kind, title, body)
  values (new.rider_id, 'rider_application', v_title, v_body);

  return new;
end;
$$;
