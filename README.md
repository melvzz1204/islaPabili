# IslaPabili

Marinduque on-demand pabili & delivery platform (MVP v1.0).

Personal-runner ("Pabili") model: local riders queue at stores on the customer's
behalf, purchase goods (cash / pre-funded), and deliver to the doorstep.

## Stack

- **Mobile (customer + rider):** React Native via Expo (managed), two apps sharing workspace packages
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)
- **Admin web:** Vite + React + TypeScript + TanStack Query
- **Monorepo:** npm workspaces + Turborepo

## Structure

```
apps/
  mobile-customer/   Expo app - ordering, tracking, ratings
  mobile-rider/      Expo app - dispatch, GPS, proof uploads, earnings
  admin-web/         Superadmin - pricing, riders, fleet monitor, reconciliation
packages/
  shared/            @isla/shared - shared types, zod schemas, fare math, constants
  eslint-config/     @isla/eslint-config - shared ESLint flat config
supabase/
  migrations/        Versioned SQL: schema + RLS + indexes
  seed.sql           Default fare config + sample merchants
  functions/         Supabase Edge Functions (planned)
```

## Getting started

1. Install dependencies: `npm install`
2. Copy `.env.example` -> `.env` per app and fill in Supabase keys.
3. Link Supabase CLI: `supabase link --project-ref wxkbdejcwkpyggmmohgo`
4. Apply migrations: `npm run db:migrate`
5. Run apps:

   - Customer app: `npm run dev:customer`
   - Rider app: `npm run dev:rider`
   - Admin web: `npm run dev:admin`

## Common commands

- `npm run typecheck` - typecheck all workspaces (turbo)
- `npm run lint` - lint all workspaces (turbo)
- `npm run build` - build all workspaces (turbo)

## Milestone status

- [x] M1: Monorepo scaffold + Supabase project + migrations/RLS skeleton + CI
- [ ] M2: Auth + onboarding (customer & rider)
- [ ] M3: Fare engine + merchant catalog + custom checklist
- [ ] M4: Customer order flow (estimate -> checkout -> voucher)
- [ ] M5: Dispatch loop + rider lifecycle + photo uploads
- [ ] M6: Live tracking + order-tracking screens
- [ ] M7: Ratings + wallet/reconciliation groundwork
- [ ] M8: Admin web (pricing, rider approvals, fleet monitor, reconciliation)
- [ ] M9: Hardening (RLS/index audit, load test, EAS build)