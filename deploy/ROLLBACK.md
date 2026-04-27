# FlashBooker — Rollback Plan

When prod breaks, the question is: **was it the code, or was it the data?** Different recoveries.

## Decision tree

```
Symptoms appear after deploy
├── Code-only regression (UI bug, 500 in a route, broken middleware)
│     → Vercel instant rollback (Step A)
├── New migration + code together, schema is now incompatible
│     → Vercel rollback + migration revert (Step B)
└── Data corruption (bad write at scale, accidental UPDATE/DELETE)
      → Supabase PITR / logical restore (Step C)
```

---

## Step A — Vercel instant rollback (≤2 min)

Use this for any code regression — failed build is auto-rolled back, but a regression that *built* and *deployed* needs you to act.

1. Vercel Dashboard → Project → Deployments.
2. Find the last green deployment (the one before today's bad deploy).
3. Click ⋯ → **Promote to Production**. The alias swap is atomic.
4. Confirm by visiting `/login` and the dashboard.
5. Watch logs for 2 minutes; confirm 500 rate dropped.

**CLI alternative:** `vercel promote <deployment-url> --scope=<team>`

**Caveats:**
- A rollback re-runs no migrations. If the bad deploy ran a forward-compatible migration, you can leave it. If it ran an incompatible one, go to Step B.
- Cron schedule is per-project, not per-deployment — rolling back doesn't change the schedule. Fine.

---

## Step B — Code + schema rollback

Use when the bad deploy added a column that the rolled-back code doesn't know about, OR removed/renamed a column the old code reads from.

1. Identify the offending migration. Migrations are in [supabase/migrations/](../supabase/migrations/) and run manually in the Supabase SQL editor (the project does not use `supabase db push` in CI as of now).
2. **Forward-compatible migration** (added a column with a default, added a table): leave it. The old code ignores the new column. Done after Step A.
3. **Incompatible migration** (renamed/dropped/changed-type a column): write a *reversal* migration in the SQL editor. **Do not edit the original migration file** — write a new one numbered higher.

   Example (revert a rename):
   ```sql
   ALTER TABLE bookings RENAME COLUMN new_name TO old_name;
   ```

4. Re-run Step A to swap code back.
5. Add the reversal migration to `supabase/migrations/` with a new timestamp (`20260427_revert_<thing>.sql`) and commit. The next forward deploy includes it.

**Per project memory** ([project_db_migration_pattern.md](../.archived/...)): missing columns cause **silent null returns** rather than errors in this codebase. If the rollback shows blank fields where data should appear, the problem is a missing column the old code expects but the rollback didn't recreate.

---

## Step C — Data corruption / accidental destructive write

The app is multi-tenant. A bad UPDATE without a `WHERE artist_id` clause is the worst case here. Two paths:

### C.1 — Point-in-time restore (Pro plan only)
1. Supabase Dashboard → Database → Backups → **Restore from point in time**.
2. Pick a timestamp ~2 minutes before the bad write.
3. **This restores the entire project** — anyone using the live app between then and now will lose work. Communicate before clicking restore.
4. After restore, re-verify Vercel env vars still match (they should — same Supabase project).
5. Sanity-check artist count, booking count.

### C.2 — Logical restore from `deploy/backup-now.sh` snapshot
Use when PITR is unavailable (Free plan) or you only need a few rows.
1. Spin up a temp Postgres locally (Docker `postgres:16` is fine).
2. Restore the latest snapshot:
   ```bash
   pg_restore --no-owner --no-privileges -d "postgres://localhost/temp" \
     backups/<latest>/full.dump
   ```
3. Query the temp DB for the rows you need.
4. INSERT into prod with `ON CONFLICT DO NOTHING` (safe) or UPDATE-by-id (deliberate).

### C.3 — Storage bucket recovery
Supabase Storage doesn't keep deleted-object history. If a logo or reference image was deleted:
- The local backup at `backups/<latest>/{artist-assets,reference-images}/` has it.
- Re-upload via the dashboard or the storage API.

---

## Pre-deploy: leave the door open for rollback

Before any prod deploy:
- [ ] Note the current Vercel deployment ID and pin it in a Slack/note.
- [ ] If the deploy includes migrations, run `./deploy/backup-now.sh` first.
- [ ] If a migration is destructive (drops a column), do it in two deploys:
  1. Deploy code that no longer reads/writes the column. Wait 24h.
  2. Deploy the migration that drops the column.
  This makes the column-drop step non-destructive in isolation.

## Rollback rehearsal

Once before launch:
1. Promote a known-old deployment via Vercel.
2. Confirm app still loads, login still works.
3. Promote latest back.

Total time: ~3 minutes. Do this when there are no live users, the first night after deploy. **An unrehearsed rollback is the same as no rollback.**

---

## Stripe / Square webhook secrets during rollback

If the bad deploy rotated webhook secrets in any artist's settings:
- Old webhooks signed with old secret will fail signature verification on rolled-back code IFF the new secret is what's stored in DB.
- Fix: in Stripe/Square dashboard, keep the old endpoint signing secret enabled until the rollback proves stable. They both support multiple active secrets.

## Communication template

If the rollback is user-visible, post on Twitter/email:

> Brief outage 2:14–2:21pm ET. Deploy regression rolled back. No data lost. — FlashBooker

Don't mention Stripe/Square in any user-facing comm — those are per-tenant and any single artist's webhook trouble shouldn't be aired publicly.
