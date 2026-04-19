# memory.md

## Project Status
Phase 1 — actively in progress. Core auth, onboarding, form builder, and settings are built and working. App is live at http://localhost:3000.

---

## What Has Been Built

### Auth & Onboarding
- Email + password signup/login via Supabase Auth (`/login`, `/signup`)
- Auth trigger (`supabase/migrations/20260419_auth_trigger.sql`) auto-creates an `artists` row on signup
- Onboarding flow (`/onboarding`) — artist sets name, slug, studio name, style tags, deposit amount
- Supabase clients: `lib/supabase/client.ts` (browser) + `utils/supabase/server.ts` (server)
- Admin client: `lib/supabase/admin.ts` — service role, server-only

### Database
- `artists` table: id, name, slug, studio_name, style_tags[], deposit_amount, deposit_policy
- `form_fields` table: per-artist field config (enabled, required, sort_order, placeholder, input_type, options)
- `custom_form_fields` table: artist-created extra fields (id, field_key, label, type, enabled, required, sort_order, placeholder, options)
- `deposit_policy` migration applied (`supabase/migrations/20260419_deposit_policy.sql`)
- RLS enabled on all tables — every query scoped to `artist_id`

### Form Builder (`/form-builder`)
- `FormBuilderSettings` component — toggle standard fields on/off, mark required, reorder
- Custom fields: artist can add freeform fields (label, type, placeholder, options)
- Fields persisted to `form_fields` and `custom_form_fields` tables
- `lib/form-fields.ts` normalizes both sets into a unified type

### Settings (`/settings`)
- `AccountSettings` component — edit name, slug, studio name, style tags, email
- Both `/settings` and `/form-builder` now show a **"View Live Form →"** chip in the page header
  - Opens `/{slug}/book` in a new tab
  - Only renders when `artist.slug` is set
  - Styled: muted gray → acid yellow on hover (brand spec)
  - Form builder page fetches artist slug with a lightweight separate query

### Public Booking Form
- Route: `/[artistId]/book` — publicly accessible, no auth required
- Renders artist's enabled form fields dynamically

### Other Pages (scaffolded, not fully wired)
- `/` — dashboard with pipeline summary UI (mock data)
- `/calendar` — calendar view (no Google sync yet)
- `/payment-links` — payment link management (scaffolded)

---

## Tech Stack
- Next.js 15 (App Router) + TypeScript
- Supabase (Auth + Postgres + RLS)
- Tailwind CSS + shadcn/ui
- Geist font (heading + mono)
- Resend (email — integrated, no templates yet)
- Lucide React icons
- Railway (deployment target)

---

## Decisions Made
- Payments: artists send their own payment links (Stripe/Venmo/Cash App) — no in-app processing in Phase 1
- Booking states: inquiry → reviewed → deposit_sent → deposit_paid → confirmed → completed
- Auth: Supabase email+password only for artists in Phase 1
- All DB access via server components or API routes — never from client components directly
- All form field normalization goes through `lib/form-fields.ts`
- Design: dark mode first, acid yellow `#E8FF47` as single bold accent, Geist only, no drop shadows on cards

---

## Known Problems / Gotchas
- `architecture.md` still references `/book/[artist-slug]` — actual route is `/[artistId]/book`
- Dashboard and payment-links pages render but use mock data, not live queries
- Google Calendar OAuth not implemented
- Email templates not built (Resend connected but no send logic yet)

---

## Next Actions (Priority Order)
1. Wire dashboard to live Supabase queries (pipeline state counts, today's appointments, unreviewed count)
2. Build full public booking form (`/[artistId]/book`) — render enabled fields, submit to `/api/bookings/inquiries`
3. Build booking pipeline view — list/kanban, filter by state, advance states manually
4. Email templates + auto-send on state transition (Resend)
5. Payment link send flow — embed artist's saved link in deposit request email
6. Google Calendar two-way sync
