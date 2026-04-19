# architecture.md

## System Overview
FlashBook is a multi-tenant SaaS app. Each tattoo artist is a tenant with their own data,
booking form URL, pipeline, calendar, and settings. Artists never see each other's data.
Row Level Security in Supabase enforces this at the database level.

## Core Data Flow

### Inquiry Submission (public, no auth required)
1. Client visits /book/[artist-slug] — public page
2. Fills out inquiry form — fields defined by artist in settings
3. On submit → POST /api/bookings/inquiries → saved to DB as state: "inquiry"
4. Artist receives email notification (via Resend)
5. Inquiry appears in artist's pipeline dashboard

### Booking Pipeline (authenticated — artist only)
1. Artist views inquiry in dashboard
2. Artist reviews and moves to "reviewed" — optional auto-reply email fires
3. Artist clicks "Send Deposit Request" → state moves to "deposit_sent"
   → email sent to client with artist's saved payment link
4. Artist marks deposit as received → state moves to "deposit_paid"
5. Artist confirms appointment time → state moves to "confirmed"
   → confirmation email sent to client
   → appointment written to Google Calendar via API
6. After appointment → artist marks "completed"

### Automated Messaging
- Each state transition has an associated email template
- Templates stored per-artist in DB — artist can edit them
- Auto-send flag per template — artist can disable auto-send and send manually
- All sends go through lib/email.ts → Resend API (server-side only)

### Calendar Sync
- Google Calendar OAuth: artist connects their calendar during onboarding
- OAuth tokens stored encrypted in Supabase (server-side only)
- On booking confirmed: write event to Google Calendar via app/api/calendar/
- On calendar view load: read upcoming events from Google Calendar
- In-app calendar shows both FlashBook bookings and pulled Google Calendar events

## Patterns to Follow
- All DB access: go through lib/db.ts — never call Supabase client directly in components
- All email: go through lib/email.ts — never call Resend directly elsewhere
- All Google Calendar calls: go through app/api/calendar/ routes
- State machine: only advance states in order — never skip, never go backward (except admin)
- Multi-tenancy: every DB query must filter by artist_id — enforced by RLS + verified in lib/db.ts

## Anti-Patterns to Avoid
- Don't call Supabase directly from React components — always use API routes or server components
- Don't send emails from client-side code
- Don't store Google OAuth tokens in localStorage or cookies
- Don't allow state skipping — e.g. can't send booking confirmation before deposit is paid
- Don't expose one artist's data to another — always scope queries to the authenticated artist
