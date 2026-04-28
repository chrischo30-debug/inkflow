# Week-1 health check prompt

Copy-paste this into a fresh Claude Code session at `/Users/chris/inkflow`
when you're ready to check in on the deploy. The prompt is self-contained —
the new session doesn't need to know anything about the launch except what's
in this prompt + the repo.

Phase 1 launched: **2026-04-27**.
Recommended check-in: **2026-05-04** (Monday after launch) or whenever you
remember.

---

## The prompt

```
FlashBooker Phase 1 went live one week ago at https://web.flashbooker.app
(Next.js 16 / React 19 / Supabase / Vercel Hobby). Do a brief health
check and surface anything worth my attention. Treat this as a
one-shot — don't propose long projects, just tell me what's healthy and
what isn't.

Background you can skim from this repo:
- deploy/README.md — index of all deploy artifacts
- deploy/MONITORING.md — what we said to watch
- deploy/OPTIMIZATIONS.md — known P1/P2 items, including which were
  intentionally deferred (rate limiting, Sentry)
- roadmap.md "Operations debt" section — also lists deferred items

Run these checks in order:

1. Smoke the live deploy:
     BASE_URL=https://web.flashbooker.app bash deploy/api-smoke.sh
   Report PASS/FAIL count. Anything that flipped from PASS at launch
   (38 PASS / 0 FAIL) is worth flagging.

2. Page latency spot-check:
     for p in /login /signup /terms /privacy; do
       curl -o /dev/null -s -w "%-25s %{time_total}s\n" \
         "https://web.flashbooker.app$p"
     done
   Anything > 1s is worth a closer look. Baseline at launch was all
   under 200ms.

3. Cron round-trip — confirm the daily reminders endpoint still
   authenticates with the secret in .env:
     CRON_SECRET=$(grep '^CRON_SECRET=' .env | cut -d'=' -f2)
     curl -sS -H "Authorization: Bearer $CRON_SECRET" \
       https://web.flashbooker.app/api/reminders/send
   Should return JSON with sent count + 200. If 401, the secret got
   rotated; if 5xx, something broke.

4. Git log since 2026-04-27 — list commits that landed during week 1.
   Helps me remember what changed.

5. Build the manual punchlist of things you can't see from a sandbox.
   Format as "Open this URL → look for X." For each, name the specific
   thing I'm looking for, not just "check the dashboard":
     - Vercel project dashboard → Logs tab, last 7 days, filter by
       Errors → repeated 5xx? Anything new?
     - Vercel project → Crons → /api/reminders/send → did it run each
       of the last 7 days at 13:00 UTC?
     - Supabase SQL Editor → run:
         SELECT count(*) AS failed_inquiries
         FROM bookings
         WHERE inquiry_email_failed = true;
       Any count > 0 is a Resend or send-path issue worth digging into.
     - Resend dashboard → Activity → bounce rate, complaint rate.
       >2% bounce or any complaint = investigate.

Output as a punchlist:
- ✅ Healthy
- ⚠ Worth investigating
- ❌ Broken / needs immediate fix

If everything is healthy, say so. Don't manufacture concerns. Under
400 words.
```

---

## After you run it

The session will produce a punchlist. Triage:
- ✅ items: nothing to do
- ⚠ items: spend 5 min digging if anything stands out
- ❌ items: fix immediately or roll back ([deploy/ROLLBACK.md](ROLLBACK.md))

If you want a deeper recurring check (week 2, month 1, etc.), reuse this
prompt — it works at any cadence, not just week 1.
