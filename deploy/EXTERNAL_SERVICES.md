# FlashBooker — External Services & Monitoring

Every third-party the app depends on, with what to watch during and after deploy. Grouped by criticality. Sources are real `process.env.*` references, `package.json` deps, and webhook handlers in this repo.

---

## Tier 1 — App is dead without these

### 1. Supabase (Postgres + Auth + Storage)
- **Used for:** primary database, user auth (email+password), session cookies via `@supabase/ssr`, two storage buckets (`artist-assets` for logos/booking backgrounds, `reference-images` for booking attachments).
- **Touched by:** every `app/api/**/route.ts`, `middleware.ts`, every server component.
- **Auth model:** anon + RLS for browser/server clients ([lib/supabase/server.ts](../lib/supabase/server.ts)); service-role bypass for webhooks and admin routes ([lib/supabase/admin.ts](../lib/supabase/admin.ts)).
- **Per-tenant:** No — one project, multi-tenant via `artist_id` RLS.
- **Watch during deploy:**
  - Active connection count (Supabase → Database → Performance). Vercel serverless can spike connections; watch for "too many clients."
  - SQL errors of class `22P02` (invalid input value for enum) — would mean the pipeline-v2 enum migration didn't run.
  - Auth → "Sign-ups" rate (catches signup endpoint regressions).
- **Watch ongoing:**
  - DB size growth vs plan limit (free tier 500MB, Pro 8GB).
  - Slow query log (Database → Query Performance) — look for full-table scans on `bookings`, `sent_emails`.
  - Storage bucket size (logo + reference images can balloon — there's no cleanup job).
  - Daily backup status (Pro plan only — free tier has no PITR).
- **Failure mode:** Total outage. Middleware fails to fetch user → infinite redirect loops. No graceful degradation in code.

### 2. Resend (Transactional Email)
- **Used for:** every outbound email. State-transition emails, reminders, contact-form notifications, deposit/calendar links, password resets.
- **Touched by:** [lib/email.ts](../lib/email.ts), [app/api/reminders/send/route.ts](../app/api/reminders/send/route.ts), every state transition in [app/api/bookings/[id]/route.ts](../app/api/bookings/[id]/route.ts).
- **Auth model:** `RESEND_API_KEY` (single platform key). Sender is `bookings@${FLASHBOOKER_SENDING_DOMAIN}` with display name `"{Artist} via FlashBooker"`, Reply-To = artist's `gmail_address`.
- **Per-tenant:** No — one workspace, all artists share it.
- **Watch during deploy:**
  - Resend dashboard → Activity feed for the first hour. Confirm `200`s on send, no `domain_not_verified` errors.
  - Bounce rate < 5%, complaint rate < 0.1% (Resend will throttle/suspend at higher).
- **Watch ongoing:**
  - Domain reputation in Resend → Domains.
  - Daily send volume vs plan (free 3K/mo, Pro 50K/mo). One artist with a big client list can blow this past in a single reminder cycle.
  - SPF/DKIM/DMARC alignment on `flashbooker.app`.
- **Failure mode:** [lib/email.ts](../lib/email.ts) has a silent `re_mock_key` fallback — emails will appear to "succeed" with no delivery. **The preflight script catches this.** App keeps running; users won't notice until clients complain.

### 3. Vercel (Hosting + Cron)
- **Used for:** Next.js runtime, serverless API routes, scheduled cron at `0 * * * *` hitting `/api/reminders/send`.
- **Touched by:** [vercel.json](../vercel.json), all routes.
- **Auth model:** Cron requests carry `Authorization: Bearer $CRON_SECRET`; reminders route 401s if mismatch.
- **Watch during deploy:**
  - Function invocation logs for the first 30 min — look for unhandled exceptions in middleware (highest blast radius).
  - Function duration p95 — if >2s, middleware DB calls are too slow.
  - Cron tab confirms the schedule was registered after first prod deploy.
- **Watch ongoing:**
  - Bandwidth + function-invocation count vs Hobby/Pro limit.
  - Failed cron invocations — Vercel emails on consecutive failures, but check the dashboard weekly.
  - Edge regions: middleware runs at the edge by default; confirm DB latency from chosen region.
- **Failure mode:** Any function error = 500; no retry. Cron failure = no reminders that hour (next hour's run does NOT backfill).

---

## Tier 2 — Core feature outages, not full outage

### 4. Stripe (Payments)
- **Used for:** per-artist deposit links and generic payment links via Checkout Sessions; webhook auto-advances pipeline to `sent_calendar` on payment.
- **Touched by:** [lib/payments/stripe.ts](../lib/payments/stripe.ts), [app/api/webhooks/stripe/[artistId]/route.ts](../app/api/webhooks/stripe/[artistId]/route.ts), [lib/payments/deposit-received.ts](../lib/payments/deposit-received.ts).
- **Auth model:** **per-artist.** Each artist enters their own `stripe_api_key` and `stripe_webhook_secret` in `/settings`. There is no platform Stripe account.
- **Per-tenant:** Yes — webhook URL is `/api/webhooks/stripe/<artistId>`.
- **Watch during deploy:**
  - For each test artist, fire a `checkout.session.completed` from Stripe CLI → verify booking advances.
  - Confirm signature verification rejects bogus sigs (api-smoke.sh covers this).
- **Watch ongoing:**
  - Each artist's webhook → Recent deliveries. Failures here mean their booking stays stuck in `sent_deposit`.
  - There's **no cross-tenant dashboard** — you'd need to poll each artist's stored secret and ping Stripe API per artist to monitor centrally. Skip unless onboarding > ~10 artists.
- **Failure mode:** Payment links 500 on creation; existing links keep working; webhook drops mean state never auto-advances (manual move works).

### 5. Square (Payments — Stripe alternative)
- **Used for:** same role as Stripe; one-of-two model gated by `artists.payment_provider`.
- **Touched by:** [lib/payments/square.ts](../lib/payments/square.ts), [app/api/webhooks/square/[artistId]/route.ts](../app/api/webhooks/square/[artistId]/route.ts).
- **Auth model:** per-artist `square_access_token`, `square_location_id`, `square_webhook_signature_key`, `square_environment` (sandbox|production).
- **Per-tenant:** Yes.
- **Watch:** same as Stripe. Square's webhook signing scheme is HMAC-SHA256(notificationUrl + body) — verify [lib/payments/square.ts](../lib/payments/square.ts) `verifySquareSignature` once in prod.
- **Failure mode:** identical to Stripe.

### 6. Google Calendar (OAuth)
- **Used for:** read free/busy for scheduling availability, write events on booking confirmation.
- **Touched by:** [lib/google-calendar.ts](../lib/google-calendar.ts), [app/api/auth/google/callback/route.ts](../app/api/auth/google/callback/route.ts), [app/api/calendar/availability/route.ts](../app/api/calendar/availability/route.ts), [app/api/calendar/events/route.ts](../app/api/calendar/events/route.ts).
- **Auth model:** OAuth 2.0 (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` platform-level), refresh token per artist encrypted at rest with `GOOGLE_TOKEN_ENCRYPTION_KEY` (AES-256-CBC). **Rotating that key locks every artist out.**
- **Per-tenant:** per-artist refresh token; platform OAuth client.
- **Watch during deploy:**
  - Google Cloud Console → OAuth consent → "publishing status" must be `In production`. Otherwise only test users can connect.
  - Authorized redirect URI must match `GOOGLE_REDIRECT_URI` exactly.
  - Quota usage: Calendar API 1M req/day default — fine unless you're polling.
- **Watch ongoing:**
  - Google Cloud Console → APIs & Services → Calendar API → quotas/errors.
  - Look for `invalid_grant` errors in app logs — means a refresh token was revoked; the artist needs to reconnect.
- **Failure mode:** scheduling availability shows "all slots free" (no conflict checking) — **this is silently wrong**, not an obvious failure. Confirmation events fail to write but UI still confirms.

---

## Tier 3 — Optional per-artist integrations

### 7. Kit (Newsletter Form Embed)
- **Used for:** when an artist closes books, the booking page shows a Kit embed instead of the form. Subscribers go directly into the artist's Kit list.
- **Touched by:** [app/api/artist/kit-integration/route.ts](../app/api/artist/kit-integration/route.ts), newsletter components.
- **Auth model:** per-artist `kit_api_key`, `kit_form_id`.
- **Watch:** Kit dashboard (per artist). No central monitoring.
- **Failure mode:** newsletter form silently fails to render. Books-closed page falls back gracefully.

### 8. Custom Form Webhooks (Typeform / Jotform / Zapier ingress)
- **Used for:** external forms POST to `/api/webhooks/form/<token>` to create bookings.
- **Touched by:** [app/api/webhooks/form/[token]/route.ts](../app/api/webhooks/form/[token]/route.ts), [app/api/artist/webhook-sources/route.ts](../app/api/artist/webhook-sources/route.ts).
- **Auth model:** opaque per-source token (stored plain in DB — fine for inbound-only; treat as a low-value secret).
- **Watch:** the originating service's own delivery dashboard.
- **Failure mode:** silent — submissions vanish if the token is wrong.

---

## Quick monitoring matrix

| Service | First-day signal | Steady-state metric | Hard alert threshold |
|---------|------------------|---------------------|----------------------|
| Supabase | Auth signups + DB error rate | DB size, slow queries, connection count | Any 5xx, connections >70% pool |
| Resend | Activity feed 200 rate | Bounce/complaint, daily volume | Bounce >5% or complaint >0.1% |
| Vercel | Function logs for 500s, cron registered | p95 function duration, invocation count | Cron failure 2 hours in a row |
| Stripe (per artist) | Test webhook fires | Webhook delivery success rate | Any artist's webhook <95% over 24h |
| Square (per artist) | Same | Same | Same |
| Google Calendar | OAuth round-trip works | `invalid_grant` count | Any artist with `invalid_grant` |
| Kit | Embed renders on closed-books page | n/a | n/a |
| Form webhooks | Test ping succeeds | n/a | n/a |

## Things to set up Day 1
- Resend domain auth (SPF/DKIM/DMARC) verified, no shared sender.
- Vercel email alerts on deploy failure + cron failure.
- Supabase weekly logical backup (download to S3/Drive) — see [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md).
- Manual checklist: log in to Stripe/Square dashboards once a week per artist for the first month.

## Things explicitly NOT integrated (audit confirmed)
- No Sentry / Datadog / Honeycomb / observability SDK.
- No Twilio / SMS provider.
- No analytics SDK (no PostHog, Segment, GA).
- No CDN beyond Vercel default.
- No rate-limit middleware (`@upstash/ratelimit` or similar).

If you want any of these, decide before launch — retro-fitting Sentry + an analytics SDK across 51 API routes is a day of work each.
