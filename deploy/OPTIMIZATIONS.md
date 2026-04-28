# FlashBooker — Code Optimization Opportunities

Concrete, file:line-cited issues found in this codebase that affect production performance, correctness, or observability. Prioritized P0 (block launch) → P2 (post-launch cleanup).

## P0 — Fix before launch

### P0-1. Database has only one explicit index across all 49 migrations
Grepping `CREATE INDEX` across [supabase/migrations/](../supabase/migrations/) returns exactly one hit: `contact_submissions_artist_id_idx` in [20260423_contact_form.sql](../supabase/migrations/20260423_contact_form.sql).

Every other table relies on the implicit FK index (which only covers PK lookups, not `WHERE artist_id = ?` filters when artist_id is a non-primary FK). The hottest queries — bookings by artist, sent_emails by booking, scheduling_links by artist — are sequential-scanning. RLS makes this worse: every row is filtered post-fetch.

**Fix:** add a single migration `20260427_indexes.sql`:
```sql
CREATE INDEX IF NOT EXISTS bookings_artist_state_idx ON bookings(artist_id, state);
CREATE INDEX IF NOT EXISTS bookings_artist_appointment_idx ON bookings(artist_id, appointment_date);
CREATE INDEX IF NOT EXISTS bookings_artist_sort_idx ON bookings(artist_id, sort_order);
CREATE INDEX IF NOT EXISTS sent_emails_booking_idx ON sent_emails(booking_id);
CREATE INDEX IF NOT EXISTS sent_emails_artist_created_idx ON sent_emails(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scheduling_links_artist_idx ON scheduling_links(artist_id);
CREATE INDEX IF NOT EXISTS payment_links_artist_idx ON payment_links(artist_id);
CREATE INDEX IF NOT EXISTS calendar_links_artist_idx ON calendar_links(artist_id);
CREATE INDEX IF NOT EXISTS blocked_dates_artist_date_idx ON blocked_dates(artist_id, date);
CREATE INDEX IF NOT EXISTS form_fields_artist_idx ON form_fields(artist_id);
CREATE INDEX IF NOT EXISTS custom_form_fields_artist_idx ON custom_form_fields(artist_id);
CREATE INDEX IF NOT EXISTS email_templates_artist_state_idx ON email_templates(artist_id, state);
CREATE INDEX IF NOT EXISTS webhook_sources_artist_idx ON webhook_sources(artist_id);
CREATE INDEX IF NOT EXISTS webhook_sources_token_idx ON webhook_sources(token);
CREATE INDEX IF NOT EXISTS appointment_reminders_booking_idx ON appointment_reminders(booking_id);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_artist_idx ON newsletter_subscribers(artist_id);
CREATE INDEX IF NOT EXISTS clients_artist_idx ON clients(artist_id);
```
This is non-blocking, runs in seconds on a fresh DB, additive — safe to ship.

### P0-2. Pipeline-v2 enum gap (per project memory, status: confirmed resolved 2026-04-26)
Already covered in [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md). Listed here for completeness — re-verify with `\dT+ booking_state` against prod.

### P0-3. Cron secret fail-open in prod
[app/api/reminders/send/route.ts:14](../app/api/reminders/send/route.ts#L14):
```ts
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: no secret configured, allow all
  ...
}
```
If `CRON_SECRET` is unset in prod, **any caller can trigger a full reminder cycle.** Mass email is the abuse vector. The preflight script catches missing secret but only at deploy time. **Make the route fail-closed in production:**
```ts
if (!secret) return process.env.NODE_ENV !== 'production';
```

### P0-4. Resend mock-key silent fallback
[lib/email.ts](../lib/email.ts) — if `RESEND_API_KEY` is unset, code falls back to a mock that "succeeds" without sending. Preflight catches it; **also add a startup-time assert** in production so a future env-var rotation that drops it makes the app fail loudly, not silently.

### P0-5. Public booking POST has no rate limiting
[app/api/bookings/route.ts](../app/api/bookings/route.ts) is unauthenticated by design (it's the public form submission endpoint, in middleware `safePaths`). Anyone can send 10K POSTs and create 10K booking rows + 10K Resend sends. Even with valid `artist_id`, a single bot can blow up an artist's inbox + your Resend quota.

**Fix:** add `@upstash/ratelimit` with a `5 req / 1 min / IP` rule on this route. ~30 min of work.

---

## P1 — Important, fix in week 1 post-launch

### P1-1. `getExtraBookingFields()` re-fetches the same row 3× per PATCH
[app/api/bookings/[id]/route.ts:59-71](../app/api/bookings/[id]/route.ts#L59-L71). Initial booking fetch at line 45-50 omits `google_event_id, gmail_thread_id, sent_emails`. Then `getExtraBookingFields()` is called at lines 136, 155, 182 — each call is a separate SELECT.

**Fix:** include the three columns in the initial SELECT. One-line change, no other consequences.

### P1-2. `select('*')` on artists table fetches large JSONB columns
Several routes pull `from('artists').select('*')` and use only ~12 fields:
- [app/api/bookings/[id]/route.ts:367-369](../app/api/bookings/[id]/route.ts#L367-L369)
- [app/api/bookings/[id]/send-email/route.ts:18-27](../app/api/bookings/[id]/send-email/route.ts#L18-L27)

`artists` has heavy JSONB: `payment_links`, `calendar_links`, `scheduling_links`, custom theme blobs, social links. List explicit columns. Trims request size by ~5–10× on these hot paths.

### P1-3. `.catch(() => null)` swallows all DB errors
At least 9 spots in [app/api/bookings/[id]/route.ts](../app/api/bookings/[id]/route.ts) have:
```ts
try { await supabase.from(...).update(...) } catch { /* column may not exist yet */ }
```
This swallows real failures (auth issues, constraint violations) the same as the "schema drift" case it's defending against. **At minimum log the error.** Better: replace the defensive try/catch with proper migration discipline so the columns are guaranteed to exist.

### P1-4. Reorder fires N independent UPDATEs
[app/api/bookings/reorder/route.ts:30-34](../app/api/bookings/reorder/route.ts#L30-L34) does `Promise.all` of N `update()` calls. For 50 reordered bookings that's 50 round-trips. Replace with a single SQL statement using `UPDATE ... FROM (VALUES ...) AS new_order`. Saves 90% of the round-trips.

### P1-5. Reorder has no error recovery on the client
[components/booking/PipelineView.tsx:52-63, 285-288](../components/booking/PipelineView.tsx). Optimistic update, fire-and-forget POST, no retry, no toast on failure. User sees their order, refreshes, sees it snap back. Add a response check + rollback + toast.

### P1-6. Public booking POST returns 201 even if email fails
[app/api/bookings/route.ts:177-183](../app/api/bookings/route.ts#L177-L183):
```ts
sendInquiryAutoEmail({...}).catch(err => console.error("...", err));
```
Booking saved, client gets confirmation page, but email never sent. Save a `failed_send_count` on the booking row, or add a "send failed" warning to the dashboard so the artist follows up manually.

### P1-7. ~~`recharts` shipped to all users~~ — verified not an issue
Initial concern was that any shared layout importing AnalyticsDashboard would ship recharts everywhere. **Verified false** by inspecting the Next.js build output: recharts lives in its own ~400KB chunk that is referenced ONLY by `analytics/page_client-reference-manifest.js`. Next 16's Turbopack code-splits it correctly. No fix needed.

---

## P2 — Cleanup, post-launch

### P2-1. `.json().catch(() => ({}))` patterns
[app/api/bookings/reorder/route.ts:9](../app/api/bookings/reorder/route.ts#L9), [app/api/bookings/[id]/send-email/route.ts:174](../app/api/bookings/[id]/send-email/route.ts#L174), [app/api/newsletter/[artistSlug]/route.ts:22](../app/api/newsletter/[artistSlug]/route.ts#L22), [lib/google-calendar.ts:166](../lib/google-calendar.ts#L166). Malformed payloads silently degrade to empty objects. Add a `console.warn` at minimum so it's visible in logs.

### P2-2. Calendar errors logged but PATCH still 200s
[app/api/bookings/[id]/route.ts:144, 163, 212](../app/api/bookings/[id]/route.ts). Calendar create/update/delete fails → console.error → 200 OK. UI thinks the move succeeded but Google has no event. Add a `calendar_sync_error` field on the response payload so the UI can show a banner.

### P2-3. `select(parsed)` updates unnecessary columns
[app/api/artist/booking-page/route.ts:37-42](../app/api/artist/booking-page/route.ts#L37-L42) and similar settings endpoints update the entire payload schema even when one field changed. PATCHes the user expects to be cheap touch heavy JSONB. Whitelist the changed keys.

### P2-4. Double `await` of `.catch(() => null)` in `lib/google-calendar.ts`
[lib/google-calendar.ts:166](../lib/google-calendar.ts#L166) - if the Google response isn't JSON, treats it as `{error: undefined}` and proceeds. Real API failures get mistaken for "weird response."

### P2-5. Dashboard cards fixed at `grid-cols-3`
[app/page.tsx:120](../app/page.tsx#L120) — see [TABLET_AUDIT.md](TABLET_AUDIT.md) P0-1. Per project memory, the intended pattern is `grid-cols-2 xl:grid-cols-4`.

### P2-6. Reminders cron is sequential per-artist
[app/api/reminders/send/route.ts](../app/api/reminders/send/route.ts) loops artists, then loops their bookings, awaiting each Resend send. At >100 artists with reminders enabled, this can blow past Vercel's function timeout. **Parallelize with `Promise.all` per artist** (still serial across artists to bound concurrency).

---

## Summary

- **5 P0 issues** — index migration, enum verification, cron fail-open, Resend mock fallback, public POST rate limiting. **Ship index migration before deploy; the rest are quick.**
- **7 P1 issues** — sequential queries, `select('*')`, swallowed errors, optimistic-update gaps. **Fix in week 1.**
- **6 P2 issues** — code quality + UX polish. **Fix as you touch the files.**

Total estimated effort to clear P0+P1: ~1–2 days.
