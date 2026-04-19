# memory.md

## Project Status
Phase 1 — not started. Context files created, no code written yet.

## Last Session
- Generated all AI context files (AGENTS.md, CLAUDE.md, memory.md, about-me.md, brand.md, roadmap.md, security.md, agent-docs/)
- No app code exists yet

## Decisions Made
- Stack: Next.js 15 + TypeScript + Supabase + Tailwind + shadcn/ui + Resend + Railway
- Auth: email + password via Supabase Auth
- Payments: artist sends their own payment links (Stripe, Venmo, Cash App, Squarespace) — no in-app processing in Phase 1
- Calendar: Google Calendar API sync, plus in-app calendar view
- Booking pipeline states: inquiry → reviewed → deposit_sent → deposit_paid → confirmed → completed
- Artists can choose: auto-process inquiries OR review manually before responding
- Visual style: professional and clean (Linear/Stripe aesthetic), dark mode first

## Known Problems
None yet — project hasn't started.

## Next Action
Set up the Next.js project and Supabase project, then scaffold the folder structure from AGENTS.md.
Command: npx create-next-app@latest inkflow --typescript --tailwind --app

## Gotchas
Nothing yet. Update this section when something breaks and gets fixed — format:
- [problem] → [what fixed it]
