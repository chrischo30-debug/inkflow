# FlashBooker — Production Monitoring & Alerting

The app currently has **no observability SDK** (no Sentry, Datadog, PostHog, etc.). This doc lists what to wire up plus what to watch using the *built-in* dashboards of the services already in use.

## Hard "page me" alerts

These should ring your phone, not sit in an inbox.

| Trigger | Source | Severity | Why |
|---------|--------|----------|-----|
| Vercel function 5xx > 1% over 5 min | Vercel Logs/Alerts | P1 | App-wide outage |
| Middleware error rate any | Vercel | P0 | Locks every authenticated route |
| `/api/bookings` POST 5xx (any) | Vercel | P1 | Public submission endpoint — losing leads |
| Stripe/Square webhook delivery <90% over 1h (per artist) | Stripe/Square dashboard alerts | P2 | Stuck-pipeline regression |
| `/api/reminders/send` cron failure 2 in a row | Vercel Cron | P2 | Reminders not going out |
| Resend bounce rate >5% rolling 24h | Resend Alerts | P1 | Reputation damage; will get throttled |
| Resend daily volume >80% of plan limit | Resend | P2 | Will silently start failing |
| Supabase 5xx on Database API | Supabase Logs | P0 | Total outage |
| Supabase auth signup failures | Supabase Logs | P2 | Onboarding broken |

## Soft "check the dashboard daily for 2 weeks" alerts

| Source | What to look at | What's normal | What's alarming |
|--------|-----------------|---------------|-----------------|
| Vercel Function logs | Errors filter, last 24h | a handful of `not authenticated` 401s | repeated stack traces from one route |
| Vercel Analytics | p75 LCP, FID | LCP <2.5s | LCP creeping past 4s |
| Supabase → Reports | DB CPU, RAM | <40% | sustained >70% — likely an unindexed query |
| Supabase → Auth | sign-in success rate | >98% | sudden dip = OAuth/SMTP/captcha issue |
| Supabase → Storage | Bucket size growth | linear with bookings | nonlinear = leak (dropped users not deleted) |
| Resend → Activity | delivered / bounced / complained | bounce <2%, complaint <0.05% | anything else, dig in |
| Resend → Domains | SPF/DKIM/DMARC status | all green | any "warning" |
| Stripe → Each artist's webhook | Recent deliveries | all 2xx | any 4xx/5xx — ping the artist |

## In-code observability gaps

These should be addressed before you call the launch "done":

1. **No central error reporting.** Errors die in `console.error` — never seen unless you tail Vercel logs. Wire up Sentry (free tier 5K events/mo is fine for one tenant) by adding `@sentry/nextjs` and wrapping route handlers.
2. **No request id / correlation id.** When a user reports "my booking didn't email," there's no way to find the specific server request. Add a middleware that stamps `x-request-id` and logs it.
3. **`.catch(() => null)` patterns** — see [OPTIMIZATIONS.md](OPTIMIZATIONS.md) section P2-3. These swallow real Postgres errors. At minimum, log them.
4. **Fire-and-forget email** in [app/api/bookings/route.ts:177-183](../app/api/bookings/route.ts#L177-L183): the public booking POST returns 201 even if the inquiry email fails. Add a `failed_send_count` field on bookings or push to a retry queue.
5. **No "active artist count"** anywhere. Add a query like `select count(*) from artists where last_login_at > now() - interval '7 days'` and alert if it goes to zero (= auth broken).

## Recommended SDK additions (in priority order)

1. **Sentry** ([sentry.io](https://sentry.io), 5K events/mo free) — catches every unhandled error, including in middleware, with stack traces and user context. Highest ROI for the smallest install.
2. **Vercel Analytics** (built-in, 1 click). Web vitals + page views. Free tier ~25K events/mo.
3. **PostHog** (or Plausible) — actual product analytics. PostHog has session replay which is gold for debugging "this broke for one user."
4. **Better Stack / BetterUptime** — synthetic uptime checks on `/api/check-slug`, `/login`, and a public booking page. ~$10/mo. Replaces "did anyone notice the site was down?"

If only one: install Sentry.

## Smoke-test alerts: run `deploy/api-smoke.sh` daily for the first week

Wire it as a GitHub Action on a 1/day schedule against your prod URL. It hits 51-route surface and confirms middleware redirects, auth gating, webhook signature enforcement. Failures → Slack webhook.

## Things that should fail loudly but currently fail quietly

- [ ] Resend mock-key fallback ([lib/email.ts](../lib/email.ts)) — *preflight catches it pre-deploy*; but if the env var goes missing in prod after the fact, emails silently no-op. Add a `console.error` and a startup assertion.
- [ ] Google Calendar `invalid_grant` — currently logged but not surfaced to artist. Add a `google_calendar_status: 'connected'|'reauth_required'` field on artists, set on first refresh failure, and a UI banner.
- [ ] Stripe webhook signature mismatch — currently 400s and logs, but no way for artist to know their secret is wrong. Add a `last_webhook_at` timestamp on artist; show "no webhooks received in 7 days" warning.
- [ ] Cron `CRON_SECRET` unset on server: route currently *allows all callers* in that case ([app/api/reminders/send/route.ts:14](../app/api/reminders/send/route.ts#L14) `if (!secret) return true`). Fail closed in prod.
