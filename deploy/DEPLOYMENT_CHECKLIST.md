# FlashBooker — Phase 1 Vercel Deployment Checklist

Stack: Next.js 16.2.4 (App Router) · React 19 · Supabase (SSR + service role) · Resend · Stripe · Google OAuth · Vercel cron

---

## 1. Vercel project setup

- [ ] Project framework preset: **Next.js** (not "Other"). Build command `next build`, install command `npm install`, output auto.
- [ ] Node version: **20.x** (matches `@types/node: ^20`).
- [ ] `vercel.json` cron is wired: `GET /api/reminders/send` hourly. Confirm cron tab in Vercel shows it after deploy.
- [ ] Production domain added (e.g. `flashbooker.app`) and DNS verified. Wildcard subdomain not needed — all artist pages live at `/<slug>/book`, `/<slug>/contact`, `/<slug>/newsletter`.
- [ ] Vercel password protection / preview-deployment auth disabled for production (it would block Stripe + form webhooks).

## 2. Environment variables (set for **Production** *and* **Preview**)

These are every var the code reads (verified from `grep process.env`):

| Var | Required | Notes |
|-----|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | public; same in client + middleware |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | public |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **server-only** — used by 14 API routes via `createAdminClient`. Never expose. |
| `RESEND_API_KEY` | yes | falls back to `re_mock_key` silently — verify a real key is set or no email will send |
| `RESEND_FROM_EMAIL` | optional | only used by reset-password admin route; `bookings@flashbooker.app` derived from sending domain elsewhere |
| `FLASHBOOKER_SENDING_DOMAIN` | yes (prod) | default `flashbooker.app` — must match Resend verified domain |
| `FLASHBOOKER_SENDING_LOCAL` | optional | default `bookings` |
| `SUPPORT_EMAIL` | optional | shown in legal pages / footer |
| `GOOGLE_CLIENT_ID` | yes | Google Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | yes | Google Calendar OAuth |
| `GOOGLE_REDIRECT_URI` | yes | must be **exact** prod URL `https://<domain>/api/auth/google/callback` and added in Google Cloud Console |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | yes | symmetric key for at-rest token encryption — **rotating it locks every connected artist out** |
| `CRON_SECRET` | yes (prod) | if unset, `/api/reminders/send` allows any caller — **must be set in production** |
| `NODE_ENV` | auto | Vercel sets this |

- [ ] All listed vars set in Vercel for both Production and Preview environments.
- [ ] Pull a preview deployment env locally (`vercel env pull`) and diff against `.env.local` for drift.
- [ ] Confirm no `SUPABASE_SERVICE_ROLE_KEY` value leaked into a `NEXT_PUBLIC_*` var.

## 3. Supabase

> **BLOCKER — pipeline v2 enum gap.** [lib/types.ts](../lib/types.ts) and [lib/email.ts](../lib/email.ts) use the state names `sent_deposit`, `sent_calendar`, and `booked`, but **no migration adds them to the `booking_state` Postgres enum**. State-change writes from the app will fail with `22P02 invalid input value for enum`. Before deploy, add and run:
> ```sql
> ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'sent_deposit';
> ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'sent_calendar';
> ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'booked';
> ```
> Save it as `supabase/migrations/20260425_pipeline_v2_enum_values.sql` and run in the Supabase SQL editor against prod. (Discovered 2026-04-25 while seeding demo data — closest existing enum values were `deposit_sent`, `paid_calendar_link_sent`, `confirmed`.)

- [ ] Run all 46 migrations in `supabase/migrations/` in order against the production DB. Last migration is `20260425_studio_address_and_email_logo.sql`. **Per project memory, missing columns cause silent null returns (Dashboard works, Bookings does not) — re-run pending migrations if any UI reads come back empty.**
- [ ] RLS verified on every customer-data table (`artists`, `bookings`, `clients`, `form_fields`, `custom_form_fields`, `scheduling_links`, `payment_links`, `calendar_links`, `blocked_dates`, `sent_emails`, `appointment_reminders`, `contact_submissions`, `newsletter_subscribers`, `webhook_sources`, `external_keys`).
- [ ] Storage buckets created and public-read confirmed: `artist-assets` (logos, booking backgrounds), `reference-images`. Both are auto-created at first upload — pre-create them to avoid first-request latency.
- [ ] Auth → URL configuration: Site URL set to prod domain; Redirect URLs allowlist includes `https://<domain>/auth/callback` and `https://<domain>/admin/access-relay`.
- [ ] Auth → Email templates customized (default Supabase branding otherwise leaks through password reset).
- [ ] DB trigger `handle_new_user` (from `20260419_auth_trigger.sql`) confirmed active — middleware relies on it seeding placeholder `name='Artist XXXXXX'` and `slug='artist-XXXXXXXX'` to drive onboarding redirects.
- [ ] Service role key in Vercel matches the Supabase project (cross-project key leakage is a common copy-paste bug).

## 4. Third-party integrations

### Resend
- [ ] Sending domain `flashbooker.app` verified (SPF, DKIM, DMARC).
- [ ] **Per project memory**, all mail goes via `bookings@flashbooker.app` with display name `"{Artist} via FlashBooker"`, Reply-To = artist's `gmail_address`. Send a test through `/api/bookings/[id]/send-email` and inspect headers.
- [ ] Resend webhook(s) configured if you care about bounces (not currently consumed by code — skip unless adding).

### Stripe
- [ ] Each artist sets their **own** `stripe_api_key` and `stripe_webhook_secret` via `/settings` (per-tenant model). No platform-level Stripe key in env vars.
- [ ] Production webhook endpoint URL pattern: `https://<domain>/api/webhooks/stripe/<artistId>` — confirm in Stripe dashboard for at least one test artist.
- [ ] `checkout.session.completed` is the only event consumed (verified in route). Other events are accepted but no-op.

### Google Calendar
- [ ] OAuth consent screen published (not "Testing" mode) or every connecting artist must be on the test-users list.
- [ ] Authorized redirect URI in Google Cloud Console exactly matches `GOOGLE_REDIRECT_URI`.
- [ ] Scope: `https://www.googleapis.com/auth/calendar` (verify in `app/api/auth/google/connect/route.ts`).
- [ ] Token encryption key backed up somewhere safe — losing it = every artist re-OAuths.

### Vercel cron
- [ ] After first prod deploy, hit `GET /api/reminders/send` with `Authorization: Bearer $CRON_SECRET` and confirm 200. Also hit it without the header and confirm 401.

## 5. Security review (specific to this codebase)

- [ ] **`/api/bookings` POST is unauthenticated** (intentional — public form submission). Confirm `artist_id` is validated against existing artists and rate-limit at the Vercel/Cloudflare layer if abuse is a concern.
- [ ] **`/api/uploads/reference-images` is in `safePaths`** (middleware bypass). Limits enforced in code: 8 files, 5MB each, 20MB total, image/* only. Re-verify these constants haven't been loosened.
- [ ] **`/api/webhooks/form/[token]`** uses an opaque per-source token. Confirm tokens are generated with crypto-strong randomness and stored hashed if leaking equals account takeover (currently stored plain — acceptable for inbound-only but document).
- [ ] **`/api/webhooks/stripe/[artistId]`** verifies signature against the artist's stored secret. Returns 400 if missing — good. Confirm raw body is read with `req.text()` *before* any JSON parsing (it is).
- [ ] **`/api/admin/impersonate`** issues a magic link, server-side-exchanges the OTP, redirects via `/admin/access-relay` with tokens in URL fragment. Verify only superusers can call (it does check `isSuperUser`). **Audit who has `is_superuser = true` in prod before launch.**
- [ ] `/api/admin/delete-account` and `/api/admin/reset-password` similarly gated — verify.
- [ ] Middleware safe-path `/api/auth/google/callback` is correct (OAuth needs unauth access). `/api/bookings` safe-path is intentional. No other API path should be public — audit `safePaths` in `middleware.ts:36-46`.
- [ ] Public artist routes (`/<slug>/book`, `/<slug>/contact`, `/<slug>/newsletter`) reachable while logged out — confirm `pathname.includes('/book' | '/contact' | '/newsletter')` matcher is intentional and doesn't accidentally allow `/anything-with-book-in-it`.
- [ ] CORS: no API route sets explicit CORS headers — Stripe/Google webhooks are server-to-server (fine), the public booking POST is same-origin from the artist page (fine). If you ever embed forms on third-party sites, this needs revisiting.
- [ ] CSP / security headers: **none configured in `next.config.ts`**. Consider adding at least `X-Frame-Options: DENY` (or `frame-ancestors` CSP) to prevent clickjacking on `/settings`. Booking pages may need to allow embedding — decide before adding.
- [ ] No secrets in client bundle: build locally and grep `.next/static` for `service_role`, `stripe_api_key`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`.

## 6. Functional smoke test (run on a preview deploy first)

Onboarding & auth:
- [ ] Sign up new artist → middleware redirects to `/onboarding` (placeholder name/slug detected).
- [ ] Complete onboarding (set name, slug, reply-to email) → landing on dashboard works.
- [ ] Logout, login, forgot-password → reset email arrives, link works.

Public artist surface (use the new artist's slug):
- [ ] `/<slug>/book` loads with correct accent color, fields, custom fields.
- [ ] Submit a booking → row appears in dashboard, confirmation email sent.
- [ ] `/<slug>/contact` form submits → contact_submissions row + email.
- [ ] `/<slug>/newsletter` subscribe → row in newsletter_subscribers (and Kit if integrated).

Pipeline (per `project_pipeline_v2.md`):
- [ ] Move booking through all 7 states: Submission → Follow Up → Accepted → Sent Deposit → Sent Calendar → Booked → Completed. Each transition's email template fires (or skips if `auto_emails_enabled = false`).
- [ ] Stripe deposit-paid webhook on a test booking auto-advances state and sends scheduling-link email.
- [ ] Public scheduling link `/schedule/<artistId>/<linkId>` shows calendar+slots, picking a slot auto-confirms (no request step), confirmation message displays.
- [ ] `block_full_day` flag on link blocks the whole day in the picker.
- [ ] Manually added `blocked_dates` removed from picker.

Calendar / Google:
- [ ] Connect Google Calendar via `/settings`. Disconnect. Reconnect. Confirm encrypted tokens roundtrip.
- [ ] Calendar view shows events from selected calendar.
- [ ] freeBusy used for availability (per memory: not all-day event scan).

Email branding (recent — `project_email_branding_logo.md`):
- [ ] Upload logo at `/settings`, switch `email_logo_bg` light/dark, send a test email — header logo renders correctly.
- [ ] Toggle `auto_emails_enabled = false` and trigger a state change — no email sent.
- [ ] Empty placeholders (e.g. no studio_address) strip their lines cleanly.

Admin:
- [ ] As superuser, `/admin` lists artists. "Access Account" launches relay, lands you logged in as target artist.
- [ ] Reset Password and Delete Account endpoints work and require superuser.

Cron:
- [ ] Trigger `/api/reminders/send` manually → reminder emails queued for bookings within the configured `reminder_hours_before` window.

## 7. Performance / observability

- [ ] Vercel Analytics enabled (free tier).
- [ ] Vercel Logs spot-checked for the first 24h post-launch — watch for repeated 500s on `/api/bookings`, `/api/webhooks/stripe/*`, middleware.
- [ ] Supabase Logs → API → 5xx watch.
- [ ] Resend dashboard → bounce/complaint rate after first batch of mail.
- [ ] Core public pages (`/<slug>/book`) Lighthouse score sanity-check on mobile.

## 8. Rollback plan

- [ ] Note the prior production deployment ID in Vercel — one-click rollback.
- [ ] Last migration is reversible? `20260425_studio_address_and_email_logo.sql` only adds nullable columns with defaults — safe to leave on rollback.
- [ ] If Stripe webhook secret rotated during deploy, keep both old and new secrets in Stripe until new deploy is confirmed.
