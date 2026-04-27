# FlashBooker — `deploy/` Index

Pre-deployment artifacts for Phase 1. Run order is roughly top-to-bottom; reference docs are linked inline.

## Scripts

| File | What it does | Run when |
|------|--------------|----------|
| [preflight.sh](preflight.sh) | Env vars, lint, tsc, build, secret-leak scan, migration count, middleware safe-paths | Every deploy, must pass |
| [api-smoke.sh](api-smoke.sh) | Hits all 51 routes — middleware redirects, auth gating, webhook signature enforcement | Against preview, then prod after deploy |
| [backup-now.sh](backup-now.sh) | `pg_dump` + storage bucket mirror + manifest with row counts | Before any destructive change; weekly cron |
| [load-test.sh](load-test.sh) | Booking POSTs, scheduling slot picks, public page renders under load | Once before launch, against preview |
| [seed-demo.mjs](seed-demo.mjs) | Existing — creates demo data | When setting up a test artist |

## Reference docs

| File | Content |
|------|---------|
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | The big checklist — Vercel, env vars, Supabase, Stripe, Google, security, smoke test |
| [EXTERNAL_SERVICES.md](EXTERNAL_SERVICES.md) | Every third-party + what to monitor |
| [DATA_PERSISTENCE.md](DATA_PERSISTENCE.md) | What's in-memory vs persisted; what to fix before launch |
| [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) | Backup strategy + restore procedures |
| [ROLLBACK.md](ROLLBACK.md) | How to revert code and data when prod breaks |
| [MONITORING.md](MONITORING.md) | Alerts to wire + what to watch daily |
| [PERFORMANCE_BASELINES.md](PERFORMANCE_BASELINES.md) | Target latencies, concurrency, bundle sizes |
| [OPTIMIZATIONS.md](OPTIMIZATIONS.md) | P0/P1/P2 issues found in the actual code |
| [PLATFORM_RECOMMENDATION.md](PLATFORM_RECOMMENDATION.md) | Vercel + Supabase, with reasoning |
| [TABLET_AUDIT.md](TABLET_AUDIT.md) | Tablet UX issues with file:line citations |
| [LANDING_PAGE_BRIEF.md](LANDING_PAGE_BRIEF.md) | Brief to feed Claude/designer for marketing site |

## Suggested run order before launch

```bash
# 1. Pre-flight checks (catches missing env, build errors, secret leaks)
./deploy/preflight.sh

# 2. Take a backup of whatever's in prod today
SUPABASE_DB_URL=... ./deploy/backup-now.sh

# 3. Run pending migrations against prod via Supabase SQL editor
#    Especially: index migration in OPTIMIZATIONS.md P0-1
#    Especially: pipeline-v2 enum verification

# 4. Deploy to Vercel preview (not prod yet)

# 5. Smoke-test the preview
BASE_URL=https://preview.vercel.app \
  ARTIST_ID=... ARTIST_SLUG=... LINK_ID=... \
  ./deploy/api-smoke.sh

# 6. Load-test against preview
BASE_URL=https://preview.vercel.app \
  MUTATE=1 ARTIST_ID=... ARTIST_SLUG=... LINK_ID=... \
  ./deploy/load-test.sh

# 7. Promote preview to production in Vercel
# 8. Re-run api-smoke.sh against prod URL
# 9. Watch logs for 30 min (see MONITORING.md)
# 10. Note the deployment ID in case of rollback (see ROLLBACK.md)
```

## Status — done vs left

### ✅ Done in code
- **Index migration written** ([supabase/migrations/20260427_indexes.sql](../supabase/migrations/20260427_indexes.sql)) — adds `form_fields(artist_id)`, `webhook_sources(artist_id)`, `bookings(artist_id, sort_order)`, partial `bookings(artist_id, appointment_date)`. *Still needs to be run against prod DB.*
- **Cron fail-closed** ([app/api/reminders/send/route.ts](../app/api/reminders/send/route.ts)) — production with no `CRON_SECRET` rejects all callers; dev/preview still works.
- **Resend production guard** ([lib/email.ts](../lib/email.ts)) — production throws if `RESEND_API_KEY` missing instead of silently mocking.
- **Tablet quick wins** — dashboard grid, copy/overflow button targets, input zoom, HelpTooltip sizing. (TABLET_AUDIT.md P0-1, P0-2, P0-3, P1-1, P1-2.)
- **Draft persistence** ([lib/use-local-draft.ts](../lib/use-local-draft.ts)) — email compose, completion modal (×2), and custom form field draft now survive refresh via local/sessionStorage. (DATA_PERSISTENCE.md three CRITICAL items.)

### ⚠️ Deferred (intentional, not blocking launch)
- **Rate limit on `/api/bookings` POST** (OPTIMIZATIONS.md P0-5) — low-user Phase 1, bot abuse not a concern yet. Add when usage grows or abuse appears.
- **Cross-device draft sync** — current persistence is single-device (localStorage). Fine for the iPad-primary workflow. Upgrade to a `booking_email_drafts` server table when artists start working from multiple devices.
- **Pending image upload queue in completion modal** — `File` objects can't be serialized; the typed fields persist but a refreshed tab loses unattached image picks. Acceptable trade-off; upgrade is upload-on-pick to a `drafts/` storage prefix.

### ❌ Left to do — pre-deploy
1. **Run the index migration** in Supabase SQL editor against prod ([supabase/migrations/20260427_indexes.sql](../supabase/migrations/20260427_indexes.sql)). Idempotent; runs in seconds.
2. **Verify the pipeline-v2 enum values** exist in prod: `sent_deposit`, `sent_calendar`, `booked` on the `booking_state` type. Per project memory this was resolved 2026-04-26 — just confirm with `\dT+ booking_state`.
3. **Set Vercel env vars** for both Production and Preview (full list in DEPLOYMENT_CHECKLIST.md §2). Critical: `CRON_SECRET`, `RESEND_API_KEY`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. **Take a backup** with `./deploy/backup-now.sh` before promoting.
5. **Run preflight** (`./deploy/preflight.sh`) — must pass cleanly. Lint baseline has 64 pre-existing errors that existed before this work; preflight will report them as a non-blocker if your script tolerates them, otherwise plan a separate cleanup pass.
6. **Deploy to a Vercel preview**, run `./deploy/api-smoke.sh` against it, then `./deploy/load-test.sh`. Promote when both are green.

### ❌ Left to do — post-deploy hardening (week 1)
- **Install Sentry** ([MONITORING.md](MONITORING.md)) — highest-ROI observability addition. ~1 hour.
- **Address P1 OPTIMIZATIONS** — sequential booking-fetch pattern, `select('*')` on artists, swallowed `.catch(() => null)` blocks. Total ~1–2 days.
- **Replace fire-and-forget email** in `/api/bookings` POST (returns 201 even on email failure) — at least surface failure to the artist's dashboard.
