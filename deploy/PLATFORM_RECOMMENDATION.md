# FlashBooker — Deployment Platform Recommendation

**TL;DR:** stay on **Vercel + Supabase**. No other option scores better given the actual stack and Phase-1 scale. Re-evaluate if you cross ~10K MAU or start hitting cron timeouts.

---

## What this app actually needs (from the code)

- **Next.js 16 App Router**, Server Components, server actions, edge middleware. Native to Vercel; first-class on Cloudflare; supported but bumpy on Railway/Render/Fly.
- **Postgres** via Supabase. Auth, RLS, Storage all in one — moving DB elsewhere would mean splitting auth into a separate service.
- **Cron** at `0 * * * *` for `/api/reminders/send` (Vercel native or any host with a scheduler).
- **Webhooks** from Stripe + Square + custom form sources. Need a public HTTPS endpoint with raw body access (Vercel routes get this; some edge platforms strip body).
- **OAuth callback** for Google Calendar — the redirect URI is fixed at deploy time, so the platform must give a stable production URL.
- **No long-running jobs**, no background workers, no WebSockets, no large file uploads (>20MB cap), no streaming AI responses. The boring serverless model fits.
- **One region is fine** — no data sovereignty story; tenants are US-centric.

## Scoring the realistic options

| Platform | Fit | Cost (Phase 1) | Cold starts | DB story | Cron | Rollback | Verdict |
|----------|-----|----------------|-------------|----------|------|----------|---------|
| **Vercel + Supabase** | A+ Next.js native, edge middleware, the way the code is written | ~$45/mo (Vercel Pro $20 + Supabase Pro $25) | Mild (300–600ms) on cold lambdas; `middleware` runs at the edge so the public hot path is warm | Supabase = managed Postgres + auth + storage in one | First-class | One-click promote-to-prod | **Recommended** |
| Cloudflare Pages + Workers + Supabase | A- Workers excellent for middleware; Next.js 16 still maturing on this runtime | ~$5–25/mo (CF generous free tier) | None (V8 isolates) | Same Supabase | CF Cron Triggers (separate config) | Manual via deployments list | Cheaper, riskier — Next 16 features may not all work; Stripe SDK + googleapis may need polyfills |
| Railway + Supabase | B Long-running Node container; classic server | ~$20–40/mo + DB | None (always-on) | Supabase or Railway's own PG | Railway has cron | OK, but no instant rollback | Fine if you want predictable bills, but you lose Vercel's preview-per-PR |
| Render + Supabase | B Same as Railway | ~$25/mo + DB | None | Same | Render Cron Jobs | Manual | Same trade-off; Render has slightly better dashboards than Railway |
| Fly.io + Supabase | B+ Better global distribution, more control | ~$10–30/mo + DB | None | Same | Fly Machines / GitHub Actions | Manual | Overkill for a single-region tattoo booking app |
| AWS (Amplify or App Runner) + RDS | C+ Doable, painful | $50+/mo + ops time | Varies | Self-managed Postgres = ops burden | EventBridge | Slow | Don't, unless you're already an AWS shop |
| Self-hosted (VPS + Docker) | D Big regression in ops | $5–20/mo + your time | None | Run your own PG | systemd/cron | "git pull && pm2 reload" | Don't — you'd lose Supabase Auth, Storage, RLS for free |

## Why Vercel wins for this codebase

1. **Middleware is real edge middleware.** [middleware.ts](../middleware.ts) calls Supabase on every request to gate setup state. On Vercel this runs at the edge (V8 isolate) close to the user — typically 50–150ms TTFB. On Railway/Render that's a Node round-trip.
2. **Cron is one line in `vercel.json`.** Already configured. No GitHub Actions cron, no Railway cron config drift.
3. **Preview deployments per PR.** When you ship a Stripe webhook change, you get a unique URL to point Stripe's CLI at. Tested, this would be a chore on every other platform.
4. **Image optimization.** [next.config.ts](../next.config.ts) declares `lh3.googleusercontent.com` as a remote pattern; Vercel's `/_next/image` handler is free with the platform. On Cloudflare you'd run Image Resizing ($0.50/M); on Railway you'd self-host or skip optimization.
5. **The cost is right.** Phase-1 traffic (low double-digit artists, dozens-to-hundreds of bookings/day) fits inside Vercel Hobby for a while. Move to Pro ($20/mo) only when you exceed bandwidth, need team members, or want analytics — all reasons that aren't urgent today.

## Where Vercel will hurt later (and what to do)

- **Hobby plan function timeout is 10s.** The reminders cron loops sequentially — at ~80 artists with reminders enabled it'll exceed 10s. Move to Pro before that. Pro = 60s.
- **Hobby cron is once-daily on schedule strings.** The current `0 * * * *` is hourly — already requires Pro plan.
- **No long-running jobs.** If you ever add bulk import for 10K+ bookings, you'll need to chunk it into multiple invocations or move the job to a worker (Inngest, Trigger.dev, Cloudflare Workers Queue).
- **Bandwidth tier.** 100GB/mo on Hobby, 1TB on Pro. Reference image uploads + booking page views can chew this faster than expected at scale. Move heavy assets to Cloudflare R2 + a custom domain when bandwidth becomes a real cost.

## Migration off-ramps (if needed later)

- **Vercel → Cloudflare Pages:** mostly works because Next.js. Mind the runtime — `googleapis` is heavy, may need to split out the Google calendar code into a separate Cloudflare Worker.
- **Supabase → self-managed Postgres + Auth.js + S3:** painful because of the integrated auth+storage+RLS. Don't unless Supabase pricing breaks you (>$200/mo).

## The recommendation in one paragraph

Use **Vercel** (Pro plan, $20/mo) plus **Supabase** (Pro plan, $25/mo, gets you PITR + the connection pooler). Keep the existing `vercel.json` cron, the existing edge middleware, the existing preview deployments. Don't touch the platform until you have a concrete reason — pricing doubling, cron timeout, or a feature that needs background workers. **Switching platforms is a multi-week distraction; switching when you don't have to is the most expensive thing.**
