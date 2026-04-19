# AGENTS.md

## Project
InkFlow — a SaaS web app for tattoo artists to manage their entire booking pipeline in one place.
Replaces the fragmented stack of Jotform + email + manual payment links + separate calendar tools.

Core flow: client submits inquiry form → artist reviews or auto-processes → automated messages sent
→ deposit/payment link sent → booking confirmed → appointment on calendar.

Phase 1: Inquiry forms, automated messaging, payment link sending, calendar view, Google Calendar sync.
Phase 2+: Mobile app, multi-artist studio accounts, analytics, integrated payment processing.

## Stack
Next.js 15 + TypeScript + Supabase (database + auth)
+ Tailwind CSS + shadcn/ui + Resend (transactional email)
+ Google Calendar API (calendar sync) + Railway (hosting)

## Folder Structure
app/                  Pages and routes
app/api/              Server-side API routes only — no direct DB calls from components
components/           Reusable UI components
components/ui/        shadcn/ui base components (do not modify)
lib/                  DB connection, utilities, shared types
lib/db.ts             All database query functions — use this, never query directly
lib/supabase.ts       Supabase client — use this, do not create another
lib/types.ts          All TypeScript types — add new ones here
lib/email.ts          All Resend/email sending logic lives here

## Commands
Install:  npm install
Dev:      npm run dev   (opens localhost:3000)
Build:    npm run build
Test:     npm test
Lint:     npm run lint

## Rules
- All DB access through lib/db.ts — never directly in components or pages
- All email sending through lib/email.ts — never inline
- Secrets and keys: server-side only, never in browser-visible code
- One component per file, filename matches component name
- All errors must be handled — no unhandled promise rejections or silent failures
- Google Calendar API calls: server-side only via app/api/
- Booking state machine: inquiry → reviewed → deposit_sent → deposit_paid → confirmed → completed
  Never skip states or set them directly from the frontend

## Permissions
Do without asking:   read files, fix errors, update UI, refactor components
Always ask first:    install packages, change DB schema, delete files, push to GitHub,
                     modify the booking state machine, change email templates

## NEVER
- Write API keys, secrets, or passwords directly in any source file
- Make Google Calendar or Resend API calls from browser-side code
- Install packages without asking
- Change database schema without showing migration plan first
- Skip or reorder booking pipeline states
- Log or print client personal data, payment info, or tokens to the console
- Save directly to the main branch
- Send payment links before a deposit request has been approved by the artist

## Key Files
lib/supabase.ts          Supabase client
lib/db.ts                All DB queries
lib/types.ts             All TypeScript types
lib/email.ts             Email sending via Resend
app/api/calendar/        Google Calendar sync routes
app/api/bookings/        Booking pipeline API routes

## Reference Docs
agent-docs/architecture.md    System design, data flow, state machine
agent-docs/db-schema.md       All tables, columns, relationships
agent-docs/api-reference.md   All internal API routes
agent-docs/testing.md         Testing approach and patterns
