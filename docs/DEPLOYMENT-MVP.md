# IslaPabili — Deployment MVP (Android-first, ngayon)

> Target: mag-live sa Marinduque na pinakamura pero stable. Android lang muna.

## 1. Architecture (kung ano ide-deploy mo)

```text
apps/mobile (Expo SDK 57, package: ph.islapabili.app)
  └─ EAS Build → AAB → Google Play (closed test → production)
  └─ EAS Update (OTA): https://u.expo.dev/d8522891-0d14-408a-b9d9-9a2f95feb2e0

apps/admin-web (Vite + React 19, static)
  └─ Vercel / Netlify / Cloudflare Pages (free tier)

Backend: Supabase project wxkbdejcwkpyggmmohgo.supabase.co
  ├─ Postgres (40 migrations: supabase/migrations/0001-0040)
  ├─ Auth (phone OTP via send-sms hook → Semaphore)
  ├─ Edge Functions: send-sms, push-send, reminder-send, promo-craving
  ├─ Cron: reminder-send (hourly), promo-craving (daily 11:00 Asia/Manila)
  ├─ Storage (50MB limit per file, kailangan ng buckets mula sa 0004_storage.sql)
  └─ Realtime (order tracking / dispatch)
```

Libre / walang bayad sa stack na ito:
- Maps: Nominatim (`apps/mobile/src/maps/geocode.ts`) + native reverse-geocode. Walang Google Maps API key.
- Push: `expo-notifications`. Libre.
- Payment: COD + manual GCash/Maya (`CheckoutScreen.tsx`). Walang gateway fee.

## 2. Magkano — MVP

| Item | Cost | Notes |
|---|---|---|
| Supabase Free | $0/mo | 500MB DB, 50K MAU, 5GB egress, 1GB storage. **Auto-pause pag 1 week idle.** |
| Expo EAS Free | $0/mo | 15 Android + 15 iOS builds/mo, 1K MAU OTA, low-priority queue |
| Admin-web hosting | $0/mo | Vercel / Netlify / Cloudflare Pages free |
| Google Play Console | $25 one-time (~₱1,450) | Isang bayad lang, habambuhay. Visa/Mastercard/Amex lang, bawal prepaid/PayPal |
| Custom domain (optional) | ~₱600–800/year | Para sa admin-web. Kung wala, libre `*.vercel.app` URL muna |
| Semaphore SMS OTP | ₱0.56/text ex-VAT (~₱0.63 VAT-in) | Globe/Smart/Sun/DITO. Walang monthly fee |

**Total Day 1: ~₱1,450 one-time + ₱0/mo + SMS usage.**

SMS examples (VAT-in na):
- 200 OTPs/mo ≈ ₱126
- 1,000 OTPs/mo ≈ ₱630
- 5,000 OTPs/mo ≈ ₱3,150

> Tipid tip: OTP lang ang SMS. Lahat ng status updates (order accepted, rider nearby, delivered) dapat push notification, hindi SMS.

## 3. Pre-deploy checklist

- [ ] `supabase/.env` may `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, huwag i-bundle sa mobile)
- [ ] `apps/mobile/.env` may `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (tingnan ang `.env.example`)
- [ ] `apps/admin-web/.env` may `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Semaphore API key naka-set bilang Supabase secret (`supabase secrets set SEMAPHORE_API_KEY=...`)
- [ ] `CRON_SECRET` naka-set (`supabase secrets set CRON_SECRET=...`) — ginagamit ng `reminder-send` at `promo-craving`
- [ ] `google-services.json` nasa `apps/mobile/` na (nandiyan na)
- [ ] Play Console account verified ($25 bayad na)

## 4. Deploy steps

### 4.1 Backend (Supabase)

```powershell
# Mula sa repo root
supabase login
supabase link --project-ref wxkbdejcwkpyggmmohgo
supabase db push          # 0001-0040 migrations
supabase functions deploy send-sms push-send reminder-send promo-craving
supabase secrets set SEMAPHORE_API_KEY=xxxx CRON_SECRET=xxxx
```

Pagkatapos, sa Supabase Dashboard > SQL Editor, i-run ang cron mula sa `supabase/functions/README.md`:
- `reminder-send-hourly` → `0 * * * *`
- `promo-craving-11am` → `0 3 * * *` (11:00 Asia/Manila)

Sa Dashboard > Auth > Hooks, i-point ang Send SMS hook sa deployed `send-sms` function URL.

### 4.2 Admin-web

```powershell
npm run build --workspace @isla/admin-web
```

I-upload ang `apps/admin-web/dist/` sa Vercel (o Netlify/Cloudflare Pages). Env vars sa hosting dashboard:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

### 4.3 Mobile (EAS → Play)

```powershell
# Mula sa apps/mobile
eas build -p android --profile production   # AAB, eas.json meron na
eas submit -p android                       # papunta sa Play Console
```

Sa Play Console:
1. Gumawa ng app, sagutan ang Data Safety, content rating, ads declaration.
2. **Closed test (mandatory sa personal accounts):** mag-imbita ng ≥12 testers na may Gmail, patakbuhin ng 14 tuloy-tuloy na araw.
3. Humingi ng production access, saka i-rollout (magsimula sa 20% staged rollout).

OTA fix pagkatapos mag-live (hindi na kailangan ng bagong AAB sa JS-only changes):

```powershell
eas update --channel production --message "fix: ..."
```

## 5. Go / No-go bago mag-production

- [ ] `db push` malinis, walang failed migration
- [ ] Login OTP nakakarating (Semaphore sender name/prod key)
- [ ] Test order end-to-end: customer → dispatch → rider accept → delivered (gamit ang preview APK mula sa `eas.json` preview profile)
- [ ] Admin-web nakakabasa ng orders
- [ ] Cron jobs tumatakbo (check logs ng `reminder-send`, `promo-craving`)
- [ ] Staged rollout plan + `eas update` rollback handa

## 6. Kailan lilipat sa Scale doc

Lumipat sa `docs/DEPLOYMENT-SCALE.md` pag tumama ka sa alinman:
- Supabase Free nag-pause, lumagpas 500MB DB, o kailangan ng backups
- EAS Free naubos (30 builds/mo) o lagpas 1K OTA users
- SMS bill lumalaki — panahon na para i-review ang OTP flow at push-first policy
