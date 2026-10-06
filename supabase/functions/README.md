# IslaPabili - Supabase Edge Functions (planned)

Server-authoritative logic runs here with the service-role key; clients never
hold privileged credentials. Each function validates inputs with Zod (shared
schemas in `packages/shared`) and enforces business rules.

| Function            | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `fare-calc`         | Authoritative delivery-fee computation (base + per-km + volume tier).   |
| `dispatch`          | Broadcast order to on-duty riders in a town, 30s accept window, auto-   |
|                     | expire, re-broadcast, assign rider.                                     |
| `location-heartbeat`| Throttle rider location writes (durable snapshot ~every 10s).          |
| `order-lifecycle`   | Validate status transitions and append to `order_status_log`.           |
| `auth-app-role`     | Custom access-token hook: stamp `app_role` claim from profiles on JWT.  |
| `send-sms`          | Send SMS auth hook: deliver phone OTPs via Semaphore (PH gateway).      |
| `payout-recon`      | Weekly payout reconciliation (COD vs e-wallet, commissions).            |
| `webhook-ewallet`   | GCash / Maya payment confirmation webhook (record-only for MVP).        |
| `voucher-validate`  | Redeem/validate promo vouchers at checkout.                             |
| `reminder-send`     | Re-nudge customers with orders stuck in `delivered` (no auto-complete). |
| `promo-craving`     | Daily 11:00AM lunch-craving broadcast to all customers (ad-style).      |

## Scheduled jobs (cron)

`reminder-send` (hourly) and `promo-craving` (daily 11:00 Asia/Manila) are
invoked by Supabase cron with a shared `CRON_SECRET` (set via
`supabase secrets set CRON_SECRET=...`, header `x-cron-secret`). Both also
accept an admin JWT for manual runs from the dashboard.

```sql
-- Requires pg_cron + pg_net. Run once in the SQL editor.
select cron.schedule(
  'reminder-send-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/reminder-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'promo-craving-11am',
  '0 3 * * *', -- 11:00 Asia/Manila (UTC+8)
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/promo-craving',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The 11AM nudge also fires on-device (`scheduleDailyCraving` in
`apps/mobile/src/lib/notify.ts`), so customers see it even before cron is
wired; the server broadcast additionally wakes killed/backgrounded apps.