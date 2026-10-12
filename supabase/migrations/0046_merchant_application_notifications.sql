-- =============================================================================
-- IslaPabili MVP v1.0 - 0046: merchant application notifications
--
-- Gap: submitting a merchant application wrote no notification, and
-- approve/reject wrote none either — so the bell stayed empty and the
-- MerchantGateScreen promise ("watch the notification bell for the review
-- result") never fired. Rider applications notify on submit + decision
-- (0019/0020); this mirrors that for stores with kind='merchant_application'
-- (no order_id — the app deep-links these to the merchant dashboard/gate).
-- The approval store-creation trigger (0012/0036) is left untouched; these
-- are separate triggers on the same table.
-- =============================================================================

-- Submission receipt ----------------------------------------------------------

create or replace function public.on_merchant_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, body)
  values (
    new.applicant_id,
    'merchant_application',
    'Application received',
    'Your store application for ' || new.store_name || ' was submitted and is pending review. '
      || 'You will be notified here once an administrator approves it.'
  );
  return new;
end;
$$;

drop trigger if exists trg_merchant_applications_submitted on public.merchant_applications;
create trigger trg_merchant_applications_submitted
after insert on public.merchant_applications
for each row execute function public.on_merchant_application_submitted();

grant execute on function public.on_merchant_application_submitted() to anon, authenticated;

-- Decision (approved / rejected) ------------------------------------------------

create or replace function public.on_merchant_application_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'approved' then
    v_title := 'Store application approved';
    v_body := 'Welcome to IslaPabili! ' || new.store_name
      || ' is live — log in as a merchant to open your store dashboard.';
  elsif new.status = 'rejected' then
    v_title := 'Store application not approved';
    v_body := coalesce(
      nullif(btrim(new.admin_notes), ''),
      'Please contact IslaPabili support for details.'
    );
  else
    return new;
  end if;

  insert into public.notifications (user_id, kind, title, body)
  values (new.applicant_id, 'merchant_application', v_title, v_body);

  return new;
end;
$$;

drop trigger if exists trg_merchant_applications_decision on public.merchant_applications;
create trigger trg_merchant_applications_decision
after update of status on public.merchant_applications
for each row execute function public.on_merchant_application_decision();

grant execute on function public.on_merchant_application_decision() to anon, authenticated;
