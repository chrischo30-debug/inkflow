# Inkflow Roadmap

## Completed

### Phase 1 — Pipeline Rework
- Renamed states: `reviewed` → `accepted`, `deposit_paid` → `paid_calendar_link_sent`
- Added states: `follow_up`, `rejected`
- Inquiry cards show 3-button row: Reject / Follow Up / Accept
- Reject and Follow Up open email compose with pre-loaded template, move state after send
- Completion modal captures `total_amount`, `tip_amount`, `completion_notes`
- Mail icon opens compose modal instead of auto-sending
- Split migration required: `ALTER TYPE ADD VALUE` in one file, DML in a second (Supabase transaction constraint)

### Phase 2 — Email Compose Enhancements
- Payment link and calendar link insert-at-cursor buttons in compose modal
- Inserts at textarea cursor position with smart newline handling

### Phase 3 — Bookings View
- Search bar filtering across all states
- Confirmed tab grouped by appointment date with date-header rows
- Past Clients page (`/past-clients`) — searchable, expandable rows with completion data

### Phase 4 — Appointment Reminders
- Vercel cron (`0 * * * *`) hitting `/api/reminders/send`
- Configurable: toggle + hours before (2/4/8/12/24/48/72h)
- Sends via Gmail (threaded) or Resend fallback; marks `reminder_sent_at` to prevent duplicates
- Settings → Reminders tab

### Phase 5 — Books Open / Closed
- Migration: `books_open`, `books_open_at`, `books_close_at`, `books_closed_message`
- `isBooksOpen()` checks manual toggle + optional schedule window
- Public booking form gates on open status; shows `BooksClosedPage` with artist branding when closed
- Dashboard header quick-toggle pill (green/gray, shows scheduled label)
- Settings → Books tab: toggle, custom closed message, drop schedule (auto-open / auto-close datetime)

### Phase 6 — Inbox (Gmail)
- OAuth scope updated to `gmail.modify` (read + mark-as-read)
- `lib/gmail.ts`: list threads, fetch thread detail, mark read
- `/api/inbox`, `/api/inbox/[threadId]`, `/api/inbox/reply`
- `/inbox` page — split pane: thread list + thread detail + reply area
- "Insert booking form link" pre-fills reply with booking URL template
- Graceful error when Gmail scope not yet granted (prompts reconnect)

### Phase 7 — Import Bookings
- `/api/bookings/import` — authenticated bulk insert
- `AddBookingModal` — "+ Add booking" button in Bookings header, modal with all fields
- `/import` page with two tabs:
  - **Import CSV**: drag-and-drop → auto-detect columns → mapping table → preview → bulk import
  - **Add manually**: inline form, resets after save for adding multiple entries

### Phase 12 — Contact Form & Newsletter Signup
- **Contact Form**: `/contact-form` admin page + `/{slug}/contact` public page
  - Fields: name, email, phone (optional toggle + required), message
  - Enable/disable toggle, show-on-closed-books-page toggle
  - Submissions stored in `contact_submissions` table
  - Email notification to artist via Resend on each submission; `replyTo` set to visitor's email
- **Newsletter**: `/newsletter-form` admin page + `/{slug}/newsletter` public page
  - Requires Kit (ConvertKit) API Key + Form ID (stored in `artists` table)
  - Setup gate UI guides users through connecting Kit before enabling the form
  - Subscriptions POST to `api.convertkit.com/v3/forms/{id}/subscribe`
  - Kit settings in **Settings → Integrations → Newsletter** section alongside Stripe + Cal.com
- **Books Closed embeds**: both contact and newsletter forms can be embedded on the `/{slug}/book` closed page via per-form toggle
- **Resend transactional email**: `support@flashbooker.app` domain verified (DKIM + SPF + DMARC in Cloudflare); Supabase SMTP configured to use Resend for auth emails (password reset etc.)
- **Gmail inbox improvements**:
  - `Reply-To` header extracted from Gmail API messages; inbox reply defaults to visitor email instead of app sender
  - Dropdown selector in reply area when both From and Reply-To addresses differ
  - "Tattoo inquiries only" filter now passes through all emails from the app's sending domain (`@flashbooker.app`)

### Phase 13 — Stripe Deposit Tracking & Cal.com Scheduling Links
- **Stripe deposit link generation**: "Deposit link" button on accepted/confirmed booking cards and table rows (only visible when Stripe API key is set). Clicking opens an amount modal → creates a Stripe Payment Link (with `metadata.booking_id`) via API → stores URL on booking → copies to clipboard. Re-clicking copies the existing link.
- **Stripe webhook auto-mark**: `POST /api/webhooks/stripe/[artistId]` receives `checkout.session.completed`, verifies signature with per-artist `stripe_webhook_secret`, marks `deposit_paid = true` on the matching booking.
- **Settings → Integrations**: Stripe section now shows the per-artist webhook URL to paste into Stripe dashboard + a signing secret field (only revealed once API key is saved).
- **"Deposit paid" indicator**: Green badge on booking cards and table rows once deposit is confirmed.
- **Cal.com scheduling links**: "Schedule" button on accepted/confirmed cards/rows (only when Cal.com API key is set). Server-side fetches username + event types at page load; copies `cal.com/{username}/{event}?name=...&email=...` to clipboard. Multi-event-type picker dropdown via portal.
- Both integrations are fully opt-in — dashboard works identically without them.
- New columns: `artists.stripe_webhook_secret`, `bookings.stripe_payment_link_url` (migration `20260424_stripe_deposit.sql`).

### Session — Email Pivot to Resend + Setup Guide Rework (2026-04-24)
- **Gmail integration fully removed.** Avoids Google CASA verification ($15k–$75k) for Gmail scopes. Deleted: `lib/gmail.ts`, `/app/api/inbox/*`, `/app/api/bookings/sync-replies/`, `/app/inbox/` page, `components/inbox/InboxView.tsx`, sidebar Inbox nav, "View in Gmail" / "View conversation in Gmail" links, `has_unread_reply` notification dots, Gmail card in Settings Integrations, Gmail step in /setup. Google OAuth scope narrowed to `calendar.events` only (drops `gmail.modify`, `userinfo.email`).
- **All outgoing mail now routes through Resend** with unified format: `From: "{Artist Name} via FlashBooker <bookings@flashbooker.app>"`, `Reply-To: {artist's personal email}`. Artist replies naturally in their own inbox; FlashBooker is no longer in the middle of conversations. Configurable via `FLASHBOOKER_SENDING_DOMAIN` / `FLASHBOOKER_SENDING_LOCAL` env vars. Centralized in [lib/email.ts](lib/email.ts) `buildFromHeader()`; three call sites (manual send, state-transition auto-send, reminders cron) pass `artistReplyTo: artist?.gmail_address ?? artist?.email ?? null`.
- **Onboarding Step 3** added — "How email works": 3-step visual explainer (you click Send → client sees "Your Name via FlashBooker" → replies land in your inbox) + Reply-To email confirmation (pre-filled with auth email, stored in `artists.gmail_address`).
- **Setup guide restructured** into three tiers: **Required** (booking URL + reply-to email, rose "Bare minimum" badge), **Recommended** (payment links, scheduling links, logo, amber "Best experience" badge), **Power integrations** (Stripe / Cal.com / Google Calendar API keys, grey "Optional" badge). Progress bar flags "Required done — keep going!" separately from full completion. Dropped misleading "no setup required" copy.
- **Sidebar** — default expanded (dropped auto-collapse on narrow viewports); expand/collapse toggle moved permanently to footer (same position in both states); cookie-backed persistence (`sidebar_collapsed`) so the server renders correct width, eliminating the flash-expand-then-collapse on every page navigation.
- **Legal** — privacy policy updated: Gmail removed from third-party list, Resend description clarified to mention Reply-To routing.

### Session — Analytics Expansion, Branding & Legal Pages (2026-04-24)
- **Analytics revenue breakdown**: Top Placements and Size Distribution now show per-row revenue (sum of `total_amount + tip_amount` for completed bookings) alongside counts, with a "Revenue from completed" footer total
- **Popular Request Types**: new full-width section on analytics page. Keyword-matches 16 common tattoo styles/subjects (Floral, Animal, Portrait, Script/Lettering, Geometric, Traditional, Japanese, Blackwork, Fine Line, Realism, Minimalist, Color, Skull/Dark, Celestial, Memorial, Cover-up) against booking descriptions; a single booking can match multiple types
- **New logo**: replaced `public/logo.png`; bumped sidebar sizes (collapsed 28→36px, expanded 32→44px); auth-page brand logo 64→96px; `-translate-y-3` offset on big logos to optically align with "FlashBooker" wordmark (image has heavier bottom padding than top)
- **Auth page layout**: left brand panel narrowed from 50% to `md:basis-2/5 lg:basis-[38%]` with tighter padding; right form panel dropped `xl:max-w-2xl` cap and heavy padding, content centered at `max-w-md`; login page gained inline "Forgot?" link next to Password label and OR divider before sign-up link; signup gained password hint and OR divider before log-in link
- **Legal pages**: `/terms` and `/privacy` — shared `LegalShell` component with header, prose styles, and footer. Terms covers 18+ eligibility, User Content license (logos + client reference images), third-party integrations, AAA arbitration + class-action waiver (30-day opt-out), $100-or-fees-paid liability cap, Pennsylvania governing law. Privacy separates Artist (controller) vs Client (processor on Artist's behalf) data roles, lists all third parties (Supabase, Stripe, Resend, Gmail, Google Calendar, Kit, Cal.com, Google Analytics), US-only storage, retention-until-deletion, CCPA section. Signup form links both
- **Support email default** in `/setup` updated from `chris.cho.30@gmail.com` to `support@flashbooker.app`

### Session — Form Builder & Booking Page Settings Polish (2026-04-24)
- **FormBuilderSettings redesign**: field cards replaced three-row Button block (Required: On/Off, Edit/Done, Remove from Form) with a compact header row — drag handle icon + field name + type badge + single active/inactive toggle
- **Draft-based field editing**: clicking a card row snapshots field state into `editDraft`; edits are local until Save or discarded on Cancel. Required toggle moved inside the expanded panel. Clicking the row again cancels.
- **BookingPageSettings**: "Show links" checkbox replaced with toggle switch; website/social inputs upgraded to consistent `rounded-lg` with focus ring

### Session — Calendar Redesign, Google Token Security & Cal.com Removal (2026-04-24)
- **Google OAuth token security**: AES-256-CBC encryption for refresh tokens at rest (`GOOGLE_TOKEN_ENCRYPTION_KEY` env var, 64-char hex). `encryptToken` / `decryptToken` in `lib/google-calendar.ts`; backward-compatible (plain-text tokens still work until artist reconnects). `InvalidGrantError` class — revoked tokens auto-disconnect the artist in the DB instead of crashing. All 4 call sites in bookings/[id] and calendar/events routes updated to `getGoogleAccessToken()`.
- **Cal.com fully removed**: v1 API decommissioned (410 error), v2 requires OAuth not personal keys. Deleted webhook route, calcom-events route, calcom-secret route, migration file. Removed CalcomData type, Schedule button, and picker portal from BookingCard/BookingsTable/PipelineView. Removed Cal.com card from ExternalApiSettings and step from setup guide. Scheduling links step now says "Calendly or other scheduling link."
- **Calendar week view**: replaced month grid (too cramped to read) with week view as default. 7-day columns on a shared time grid, events show full title + time. Clicking a day header drills to single-day timeline. Day view has back arrow returning to week.
- **Calendar UX**: Today button on far right; stronger `border-r-2` day separators; month picker popover (calendar icon, top-right) — clicking a day stays in week view and highlights the selected day column instead of drilling to day view; month picker icon visible on both week and day views. Event fetch anchored to today → 12 months forward, expanding dynamically when user navigates past that range (never replaces data with a narrower range).
- **Dashboard "All bookings" link** → now routes to `/bookings?state=confirmed` (booked view) instead of all bookings.
- **Setup guide**: removed Cal.com from Recommended Tools grid; updated scheduling links step description.
- **Bug fix**: `.env` had `GOOGLE_CLIENT_SECRET` and `GOOGLE_TOKEN_ENCRYPTION_KEY` concatenated on one line (missing newline), causing `invalid_client` errors from Google OAuth.

### Session — Pipeline V2, Scheduling Links & Availability (2026-04-25)
- **7-stage pipeline**: Submission → Follow Up → Accepted → Sent Deposit → Sent Calendar → Booked → Completed. `confirmed` kept as legacy alias for `booked` in all views.
- **SendDepositModal**: email compose + optional Stripe deposit link generator + scheduling link picker (sets `booking.scheduling_link_id` for Stripe automation).
- **SendCalendarModal**: email compose + scheduling link picker (existing or create new inline).
- **Stripe webhook automation**: `checkout.session.completed` on a `sent_deposit` booking auto-advances to `sent_calendar` and emails client the scheduling link URL (if `scheduling_link_id` set). Falls back to generic "we'll be in touch" email if no link.
- **Payment source tracking**: completion modal now captures Cash / Venmo / PayPal / Zelle / Stripe / Other; stored in `bookings.payment_source`.
- **Webhooks tab removed** from Settings (Stripe webhook is per-artist, configured via Integrations tab).
- **Scheduling link edits**: pencil icon on Links page opens inline edit form for each link.
- **Per-link calendar selection**: checkboxes in add/edit form choose which Google Calendars to check for conflicts (default: all).
- **Full-day session toggle**: per scheduling link — once any booking is confirmed for that day, no more slots shown.
- **Blocked Dates** (global): date picker section on Links page blocks specific dates across all scheduling links (holidays, days off). Stored in `artists.blocked_dates JSONB`. Fetched in a separate try/catch query in the slots route so a missing column can't break availability.
- **Availability fix**: removed all-day event scan from slots route (was catching birthday/anniversary/transparent events and blocking every day). Google freeBusy API already handles opaque busy events correctly. Explicit holidays → use Blocked Dates.
- **Pipeline help tooltip**: `HelpTooltip` upgraded to `createPortal` with fixed positioning (sidebar can't clip it); hover-to-open with 150ms grace; `maxHeight` clamped to viewport. Pipeline tooltip shows per-stage breakdown with dividers.
- **New migrations**: `20260425_pipeline_v2.sql` (`bookings.scheduling_link_id`, `bookings.payment_source`), `20260425_scheduling_links.sql` (`artists.scheduling_links`), `20260425_blocked_dates.sql` (`artists.blocked_dates`).

### Session — Bug Fixes & Calendar UX (2026-04-23)
- **Bookings page default tab**: changed from "Booked" (confirmed) to "All" — submissions were hidden on landing
- **Dashboard / Bookings empty data bug**: Dashboard and Bookings queries silently returned null when DB columns didn't exist (`stripe_payment_link_url`, `deposit_paid`, `has_unread_reply`, `sent_emails`); Clients query didn't select those columns so it still worked. Fix: run migrations `20260422_sent_emails.sql`, `20260423_booking_notifications.sql`, `20260424_stripe_deposit.sql` in Supabase SQL editor.
- **Calendar add-booking — event listing**: replaced "X events on this day" count with per-event rows showing time + name + source badge, so you can see exactly when not to schedule
- **Calendar add-booking — time picker**: replaced `TimeSelect` (`<select>` with 31 options, prone to viewport clipping) with `<input type="time">` for direct entry without dropdown positioning issues

---

## Planned

### Phase 8 — Setup & Integrations Guide ✓
- `/setup` page with progress bar (X of 5 steps complete)
- Live status for: booking URL, logo, Gmail, payment links, calendar links
- Recommended tools cards: Cal.com, Stripe, Kit (Venmo removed — Stripe preferred)
- Get help section with support email (`SUPPORT_EMAIL` env var)

### Phase 9 — Superuser Panel ✓
- `is_superuser` boolean on `artists` table (renamed from `is_admin` via migration); manually set for operator account
- `/admin` page: all artists with booking stats; superuser accounts marked with SU badge
- `/admin/artists/[artistId]` detail page: profile, booking state summary, recent bookings
- **Access Account**: server-side OTP exchange — API generates token + immediately verifies via `POST /auth/v1/verify`, returns real session tokens; client opens `/admin/access-relay` relay page which calls `setSession()` and redirects to `/`. Bypasses Supabase OTP expiry entirely.
- **Reset Password**: generates `recovery` link for the artist; superuser copies and sends
- **Delete Account**: `admin.auth.admin.deleteUser()`; blocked for superusers and self-deletion
- Superuser link in sidebar; middleware guards all `/admin/*` routes

### Phase 10 — Dark Theme Toggle
Dark mode option in dashboard settings.

### Phase 11 — Password Reset Flow ✓
- `/forgot-password` page — email input, calls `supabase.auth.resetPasswordForEmail()` with callback redirect
- `/reset-password` page — new + confirm password fields, calls `supabase.auth.updateUser()`, guards against expired links
- "Forgot your password?" link on login page
- `/forgot-password` added to middleware safePaths

---

## Original Backlog (not scheduled)
- Mobile app (iOS / Android)
- Multi-artist studio accounts
- In-app payment processing (Stripe Connect)
- SMS messaging (Twilio)
- Analytics (revenue, booking rate, drop-off by stage)
- Waitlist management
- Client portal (client sees their own booking status)
- Deposit automation (auto-mark paid via Stripe webhook) ✓ — done in Phase 13
- Custom domain for booking form
- Instagram DM integration
