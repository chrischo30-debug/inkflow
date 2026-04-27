# FlashBooker — Backup & Recovery

What to back up, how often, where to store it, and how to restore. This app's authoritative data lives in three places: Supabase Postgres, Supabase Storage, and per-artist Google Calendars (the calendar is the artist's, not yours — out of scope for backup).

## What needs backing up

| Source | What's in it | Loss impact |
|--------|-------------|-------------|
| Supabase Postgres | Artists, bookings, clients, form fields, scheduling links, payment links, blocked dates, sent emails, contact submissions, newsletter subscribers, webhook sources, external keys (Stripe/Square credentials, encrypted Google tokens), email templates, completion images metadata | Catastrophic — the whole product |
| Supabase Storage `artist-assets` bucket | Logos, booking-page background images | Visual regression; recoverable from artist if lost |
| Supabase Storage `reference-images` bucket | Client-uploaded tattoo references on bookings | High — clients won't re-upload |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` env var | Decrypts the per-artist Google refresh tokens stored in `artists.google_refresh_token` | Loss = every artist must reconnect Google Calendar |
| Stripe webhook secrets, Square access tokens | Stored in `artists` row; included in DB backup | Same as DB loss — but artists can re-enter |

## Built-in Supabase backup options

- **Free tier:** 1 daily logical backup retained 7 days. No PITR.
- **Pro tier:** 7-day daily backups + PITR up to 7 days back ($25/mo).
- **Storage** is **not included** in those backups — you must back up buckets separately.

## Recommended setup

**Day 1:**
1. Move project to Pro plan (or accept 7-day daily-only on Free). PITR is what you want for "restart at 3:42pm before the bug."
2. Add a weekly logical dump cron (script below) that downloads `pg_dump` to a separate cloud — S3 / B2 / Drive. Don't keep your only backup inside Supabase.
3. Mirror both Storage buckets weekly to the same offsite location.
4. **Print the `GOOGLE_TOKEN_ENCRYPTION_KEY` and put it in 1Password.** Lose that and the encrypted column in your DB backup is unreadable.

**Run interactively before any destructive change** (migration that drops/renames a column, schema rework, etc.):
```bash
./deploy/backup-now.sh
```

## `deploy/backup-now.sh`

This script ships with the deploy folder. It produces a timestamped folder:
```
backups/2026-04-27T14-12-03Z/
  schema.sql        # pg_dump --schema-only
  data.sql          # pg_dump --data-only --inserts
  full.dump         # pg_dump -Fc (use this to restore)
  artist-assets/    # mirrored bucket
  reference-images/ # mirrored bucket
  manifest.json     # row counts + git sha + timestamp
```
Requires `pg_dump`, the Supabase service-role connection string in `SUPABASE_DB_URL`, and the `supabase` CLI for storage mirroring.

## Restore procedures

### Full restore (DB only)
1. Provision a fresh Supabase project (or wipe target — see PITR option below).
2. Run all migrations in `supabase/migrations/` in order to recreate schema and triggers.
3. `pg_restore --no-owner --no-privileges --data-only -d "$SUPABASE_DB_URL" backups/<ts>/full.dump`
4. Re-upload storage buckets (manifest helps verify counts).
5. Re-confirm `auth.users` rows match `public.artists` rows — if not, run the `handle_new_user` trigger fix manually for orphans.
6. Update Vercel env vars to point at new project; redeploy.
7. Each connected artist: their stored Google refresh token is still valid IFF you preserved `GOOGLE_TOKEN_ENCRYPTION_KEY`. If not, they all reconnect.

### Point-in-time restore (preferred for accidental data loss)
On Pro plan: Supabase Dashboard → Database → Backups → Restore to point in time. Pick the timestamp from before the bad write. **This restores the whole project, not a single table** — coordinate with anyone using the live app.

### Single-table or single-row recovery
PITR doesn't support row-level. Two options:
1. Restore the daily/weekly logical backup into a temp Postgres locally, query/extract the rows, then `INSERT … ON CONFLICT DO NOTHING` into prod.
2. If you have the prior row in `pg_dump --inserts` form, just re-run the relevant `INSERT`.

## Test the backup. Today.

```
./deploy/backup-now.sh                                      # produce a backup
docker run --rm -p 5433:5432 -e POSTGRES_PASSWORD=x postgres:16
psql -h localhost -p 5433 -U postgres -c 'create database t;'
psql -h localhost -p 5433 -U postgres -d t -f backups/<ts>/schema.sql
pg_restore -h localhost -p 5433 -U postgres -d t --data-only backups/<ts>/full.dump
psql -h localhost -p 5433 -U postgres -d t -c 'select count(*) from bookings;'
```
If row count matches the manifest, the backup is real. **An untested backup is not a backup.**

## What this strategy does NOT cover

- The `auth.users` table lives in Supabase's reserved schema. `pg_dump` against your service-role connection should include it, but verify on first dump. If it doesn't, you'll need to use Supabase's API to export users separately, and they have no `SignUp` API for password hashes — meaning a true cross-project restore needs Supabase support.
- Stripe / Square histories live in their dashboards. The app does not store transaction logs beyond `payment_link_url` + `payment_status`.
- Sent emails: Resend keeps logs ~30 days. The `sent_emails` table records what we *sent* but not the rendered HTML. If you need to prove what a client received, save Resend log retention long-term in their dashboard settings.
- `.next/` cache, build artifacts — not backed up; rebuilt from source on redeploy.
