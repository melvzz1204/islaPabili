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