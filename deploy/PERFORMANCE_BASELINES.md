# FlashBooker — Performance Baselines

Targets to lock in *before* launch so you can spot regressions afterward. Numbers are based on the actual stack (Next.js 16 App Router, React 19, Vercel serverless functions, Supabase Postgres) and the queries each route does.

Measure on a Vercel Production deployment, US-East region (matching Supabase's typical region), warm — discard the first request after 10+ minutes of inactivity (cold start).

## Page response time targets (TTFB + first paint)

| Route | What it does | p50 target | p95 target | Alarm bell |
|-------|--------------|------------|------------|------------|
| `/<slug>/book` | Server fetch artist + form_fields + custom_form_fields | 350ms TTFB | 800ms | >1.5s |
| `/<slug>/contact` | Single artists query | 250ms | 500ms | >1s |
| `/<slug>/newsletter` | Single artists query | 250ms | 500ms | >1s |
| `/login` | Static-ish | 150ms | 350ms | >700ms |
| `/` (dashboard) | Auth + artist + bookings list | 600ms | 1.5s | >3s |
| `/bookings` | Auth + bookings + form_fields + custom_form_fields | 700ms | 1.7s | >3s |
| `/calendar` | Auth + bookings + Google freeBusy round-trip | 1.0s | 2.5s | >5s (Google call) |
| `/analytics` | Auth + multi-table aggregations | 800ms | 2.0s | >4s |
| `/settings/*` | Auth + per-tab data fetch | 400ms | 900ms | >2s |
| `/schedule/<artistId>/<linkId>` | Public — artist + scheduling-link + Google freeBusy | 700ms | 1.6s | >3s |

LCP target on `/<slug>/book` (mobile, 4G simulated): **< 2.5s**. This is the primary funnel page; clients abandon at 3s.

## API response time targets

| Endpoint | Method | Target p95 | Notes |
|----------|--------|------------|-------|
| `/api/check-slug` | GET | 200ms | One indexed lookup |
| `/api/bookings` | POST | 1.2s | Inserts booking + sends email |
| `/api/bookings/[id]` | PATCH | 1.5s | Pipeline transition + email + Google |
| `/api/bookings/[id]/send-email` | POST | 1.0s | Resend + DB write |
| `/api/bookings/reorder` | POST | 600ms | N updates in parallel |
| `/api/calendar/availability` | GET | 1.5s | freeBusy on artist's calendars |
| `/api/schedule/[a]/[l]/slots` | GET | 1.2s | Same |
| `/api/webhooks/stripe/[a]` | POST | 800ms | Signature verify + DB write + email |
| `/api/webhooks/square/[a]` | POST | 800ms | Same |
| `/api/reminders/send` (cron) | GET | 5s per artist | Bounded by per-artist email count |
| `/api/uploads/reference-images` | POST | 2s for 8 × 5MB | Multipart to Storage |

## Concurrency expectations

This is a multi-tenant booking app. Realistic concurrency for Phase 1 (low double-digit artists, each with low-double-digit bookings/week):

- **Steady state:** 1–3 concurrent requests, mostly artist dashboards.
- **Spike pattern 1 — book release:** an artist announces "books open at 6pm." 50–500 simultaneous public form submissions in a 5-minute window. Each is a single insert + email. **Expected to handle: 20 req/s sustained for 5 min, 200 max in any 1-second burst.**
- **Spike pattern 2 — flash sale:** scheduling-link slot picker. 50–100 clients hitting `/schedule/<a>/<l>/slots` in the same minute. This calls Google freeBusy — Google's quota is 1M req/day, fine, but each slot fetch is ~600ms.
- **Cron concurrency:** `/api/reminders/send` walks all artists serially per the for-loop in [app/api/reminders/send/route.ts](../app/api/reminders/send/route.ts). At 100 artists with 5 reminders each, that's 500 sequential Resend sends inside one function invocation — **may exceed Vercel's 10s function timeout on Hobby plan.** Pro is 60s. Verify on Pro.

## Bundle size targets

After `npm run build`, report on `.next/server/app/**/page.js` and `.next/static/chunks/`:

| Chunk | Target | Audit |
|-------|--------|-------|
| First-load JS for `/` | <250KB gzipped | check after build |
| First-load JS for `/<slug>/book` | <180KB | this is the public page |
| `recharts` | should appear ONLY on `/analytics` | confirm via `next build --profile` output |
| `googleapis`, `stripe`, `resend`, `@supabase/ssr` | should NOT be in any client bundle | grep `.next/static` |

## How to measure

```bash
# 1. Cold + warm latency from outside Vercel:
for i in 1 2 3 4 5; do
  curl -o /dev/null -s -w "%{time_total}\n" https://your-domain/api/check-slug?slug=test
done

# 2. Lighthouse on the booking page (mobile):
npx lighthouse https://your-domain/<test-artist>/book --form-factor=mobile --only-categories=performance

# 3. Bundle inspection:
npm run build
ls -la .next/static/chunks | sort -k5 -n | tail -20
```

## Recording the baseline

Right after first prod deploy, capture these numbers in [PERFORMANCE_BASELINE_LOG.md](./PERFORMANCE_BASELINE_LOG.md) (create on first run). Each subsequent month, re-measure and diff. Anything >1.5× the baseline is worth investigating.

## Known degradation risks

- The bookings list endpoint does multiple `.select('*')` patterns ([OPTIMIZATIONS.md](OPTIMIZATIONS.md) P1-1, P1-2) and grows linearly with `bookings.row_count`. Will become noticeable past ~5K bookings per artist.
- No DB indexes beyond the one on `contact_submissions` ([OPTIMIZATIONS.md](OPTIMIZATIONS.md) P0-1, P0-2). Each table query is sequential-scan-by-RLS for now. Add indexes before crossing ~1K bookings table-wide.
- The `/api/reminders/send` cron is unbatched. At >200 artists × 10 bookings/cron, one run may exceed the 60s function timeout.
