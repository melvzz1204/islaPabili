# IslaPabili — Deployment Scale (pag lumalaki na)

> Gamitin ito pag lumagpas ka na sa MVP free tiers. Kasama ang triggers, presyo 2026, at upgrade path.

## 1. Upgrade triggers (kailan gumastos)

| Signal | Ibig sabihin | Aksyon |
|---|---|---|
| Supabase project nag-pause / 500MB DB malapit na mapuno | Free limit | Supabase Pro $25/mo |
| Kailangan ng daily backups, 7-day logs, walang pause | Pang-prod SLA | Supabase Pro $25/mo |
| EAS low-priority queue 90+ min, o naubos ang 30 builds/mo | Build bottleneck | EAS Starter $19/mo |
| OTA users >1K (Free) / >3K (Starter) | Marami nang gumagamit ng update channel | EAS Starter → Production $199/mo |
| Edge function invocations >500K/mo (Free) | Maraming SMS/dispatch/cron calls | Pro: 2M kasama, $2 per 1M sobra |
| Realtime messages >2M/mo, connections >200 | Maraming live tracking | Pro: 5M messages, 500 connections; $2.50 per 1M sobra |
| SMS bill >₱3K/mo | Maraming OTP | Push-first policy + OTP rate-limit (tingnan §4) |
| Kailangan ng iOS | App Store launch | Apple Developer $99/year (~₱5,800/year) |

## 2. Magkano — scale pricing (2026)

### Supabase
- **Pro: $25/mo (~₱1,450/mo).** Kasama: 100K MAU ($0.00325/MAU sobra), 8GB DB ($0.125/GB sobra), 250GB egress ($0.09/GB sobra), 100GB storage ($0.021/GB sobra), 2M function invocations ($2/1M sobra), daily backups 7 days.
- Compute add-on: Micro $10/mo (sakop na ng $10 credit sa Pro, kaya 1 project ≈ $25 pa rin), Small $15, Medium $60, Large $110 pataas. Mag-upgrade lang pag mabagal ang DB sa peak.
- **Team $599/mo:** para lang sa SOC2/SSO/HIPAA. Hindi kailangan ng IslaPabili sa ngayon.

### Expo EAS
- **Starter $19/mo (~₱1,100):** $45 build credit, high-priority queue, 3K OTA MAU.
- **Production $199/mo (~₱11,500):** $225 build credit, 2 concurrencies, 50K OTA MAU, priority support.
- Build overage (pag naubos ang credit): Android ~$1, iOS ~$2 bawat build.
- OTA overage: ~$0.005/MAU sa unang tier.

### Iba pa
- Admin-web: manatili sa free hangga't kaya. Vercel Pro $20/mo lang kung lumagpas sa free bandwidth — mas mura ang Cloudflare Pages (libre, malaki ang free egress).
- Google Play: walang dagdag bayad pagkatapos ng $25 one-time. Apple: $99/year kung mag-iOS.
- Domain: ~₱600–800/year (.com). `.ph` mas mahal (~₱1,500+/year).
- Semaphore: parehong ₱0.56/text ex-VAT kahit lumaki. Walang volume discount na aasahan sa maliit na volume.

### Projection samples (monthly, walang Apple)

| Scale | Supabase | EAS | SMS (hal. 1 OTP/user/mo) | Admin-web | Total |
|---|---|---|---|---|---|
| 1K users | Pro $25 | Free $0 | ~₱630 | $0 | **~₱2,100** |
| 10K users | Pro $25 + konting egress | Starter $19 | ~₱6,300 | $0 | **~₱8,800** |
| 50K users | Pro $25 + overages (~$10–30) | Production $199 | ~₱31,500 | $0–20 | **~₱45,000–50,000** |

> Pinakamalaking variable cost sa scale ay **SMS**, hindi Supabase/EAS. Kaya push-first ang #1 cost control.

## 3. Upgrade path (sunod-sunod, huwag sabay-sabay)

1. **Supabase Free → Pro ($25).** Una ito palagi. Dahilan: no-pause + backups + 8GB DB. Walang code change.
2. **EAS Free → Starter ($19).** Pag mabagal ang builds o lumalampas sa 1K OTA users.
3. **DB compute Micro → Small ($15) / Medium ($60).** Pag mataas ang CPU/RAM sa Supabase dashboard tuwing tanghalian/gabing peak. Hourly billing, pwedeng i-downgrade.
4. **EAS Starter → Production ($199).** Pag >3K OTA users o kailangan ng 2 concurrencies at priority support.
5. **Storage/egress hygiene** bago magbayad ng overage: i-compress ang `merchant/menu photos` (tingnan ang `0030_jollibee_menu_photos`, `0032_pabili_list_photos`), ayusin ang RLS indexes (`0003_indexes`), limitahan ang realtime subscriptions sa active order screen lang.
6. **iOS ($99/year) + EAS iOS builds.** Huli ito. Kailangan ng Mac-less EAS build + App Store review (mas mahigpit sa location/background permissions).

## 4. Cost control checklist (pinakamahalaga sa scale)

- [ ] Push-first: lahat ng order status via `push-send` + `expo-notifications`. SMS = OTP at critical fallback lang.
- [ ] OTP rate-limit: max 5 resends per number per hour (i-enforce sa `send-sms` function).
- [ ] Rider `location-heartbeat` naka-throttle na (~10s snapshot, huwag bawat segundo) — tipid sa Realtime messages at DB writes.
- [ ] Cron (`reminder-send` hourly, `promo-craving` daily) may `x-cron-secret` at hindi nagdo-double send.
- [ ] Storage lifecycle: i-resize ang food photos sa upload (Expo `image-manipulator` gamit na), burahin ang luma/rejected compliance docs (`0017_compliance_doc_limits`).
- [ ] Spend caps: mag-set ng Supabase spend cap + EAS usage alerts (80%/100% email).
- [ ] Quarterly review: DB size, MAU, egress, function invocations — nasa Supabase Dashboard > Usage.

## 5. Operasyon sa scale

- **Releases:** `eas.json` channels (`development` → `preview` APK → `production` AAB). Staged rollout sa Play (20% → 50% → 100%). JS-only fix via `eas update`, native change via bagong AAB.
- **Database:** bago mag-migrate (`supabase db push`), mag-backup. Pag Pro na, may PITR option (may dagdag bayad) kung kailangan ng per-minute restore.
- **Monitoring:** EAS Observe + Supabase logs (7-day retention sa Pro; Log Drains +$60/drain kung kailangan ng external logging).
- **Security:** service-role key nasa Edge Functions lang; admin-web at mobile publishable key lang (tingnan ang `supabase/.env.example` comment). I-rotate ang `CRON_SECRET` at Semaphore key pag may staff change.

## 6. Hindi pa kailangan (pero alam mo lang)

- Supabase Team $599/mo, Enterprise custom — pang-compliance (SOC2/SSO/HIPAA) o dedicated support.
- Read replicas, dedicated IPv4, custom domains sa Supabase — pang-high traffic o whitelabel.
- Self-hosting ng Supabase — libre sa lisensya pero ikaw ang magbabayad ng VPS + maintenance. Mas mahal sa oras kaysa $25/mo sa ngayon.
