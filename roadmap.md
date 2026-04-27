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

### Session — UX Polish, Coachmarks & Email Branding (2026-04-25)
- **AddBookingModal calendar checks**: artist-side date picker now uses freeBusy (skips transparent events) + respects `blocked_dates`. New `/api/calendar/availability` endpoint returns busy intervals + blocked dates. Conflict warning when picked time overlaps a busy interval.
- **Public scheduling auto-confirm**: SchedulingPicker drops the "request" handoff — picking a slot immediately confirms (booking → `booked`, emails artist + client). Wording cleaned up across UI and notification email. Per-link `confirmation_message` field — artists customize what clients see after picking.
- **Public scheduling UX overhaul**: replaced 3-step `calendar → slots → confirm` flow with a single side-by-side panel (calendar left, slots right; stacks on mobile). Confirm button lives inside the slots panel. Past dates, day-of-week, and `blocked_dates` are all greyed in the calendar.
- **Studio address + Maps link in client emails**: new `studio_address` column. Client confirmation and reschedule emails include the address with a Google Maps URL when set. Settings has a "Preview on Google Maps" link so artists can verify the address resolves correctly.
- **Logo lifted to AccountSettings**: same `artists.logo_url` powers the booking page and the client email header. Upload UI now in Settings → Profile (was previously only in Booking Page settings). Email logo toggle (`email_logo_enabled`), light/dark header background picker (`email_logo_bg`).
- **HTML email rendering**: `lib/email.ts` `sendEmail` now produces both text + HTML; HTML version has a centered logo header in the artist's chosen background color. `applyPlaceholders` strips lines whose tokens resolve to empty so clients never see raw `{appointmentDate}` text.
- **Reschedule notification**: `update_appointment` for booked/confirmed bookings now emails the client with new time + previous time + Maps link. Only fires when the date actually changed.
- **Auto-emails master kill switch**: `artists.auto_emails_enabled` (toggle at top of Emails tab) gates state-transition, deposit-paid, scheduling-confirmation, and reschedule emails. Reminders keep their own toggle.
- **Email template defaults rewritten**: all 8 stage templates + reminder + Stripe webhook templates redone in casual, direct copy. No em dashes, no hype phrases. Subjects shortened (no trailing `– {artistName}`).
- **Coachmark system** (`components/coachmarks/Coachmark.tsx`): per-device localStorage-backed guided tips with spotlight ring; click-outside dismiss; global "Don't show tips" kill. Tips wired across every page: dashboard pipeline (3 + first-drag triggered), bookings/calendar/links/analytics/form-builder page intros, settings tabs (auto-emails toggle, stage templates, variables, booking page, Stripe API key + webhook).
- **First-drag explainer** in PipelineView fires the first time a card is dropped; explains stage progression, auto emails, and how to undo.
- **Settings copy expansion**: `SectionHeading` now takes `string | string[]` for multi-paragraph descriptions. All four tabs (Profile / Integrations / Emails / Reminders) and key cards (Google Calendar, Stripe API key, master auto-emails) broken into short paragraphs at `text-sm` / `text-base` instead of cramped `text-xs` blocks.
- **Setup guide bugfix**: page used a narrow `select(...columns...)` that returned `null` for the entire row when any newly-added column was missing — silently marking every step incomplete. Refactored to a single `select("*")`. "Add payment links" step now also marks complete when Stripe is connected.
- **Tooltip text upsized**: Coachmark card width `w-80 → w-96`, title `text-sm → text-base`, body `text-xs → text-sm` with `space-y-2.5` for paragraph breaks.
- **New migration**: `20260425_studio_address_and_email_logo.sql` (`studio_address`, `email_logo_enabled`, `email_logo_bg`, `auto_emails_enabled`).

### Session — Square Payment Integration (2026-04-27)
- **Multi-provider payments**: artists can now connect either Stripe or Square (one-of-two model). New `artists.payment_provider` enum + `square_access_token`, `square_location_id`, `square_webhook_signature_key`, `square_environment` columns. Migration: `20260427_square_integration.sql` (run ALTER block first, then UPDATE backfills separately per Postgres planner constraint). Existing Stripe artists are auto-tagged `payment_provider='stripe'`.
- **Provider adapter** (`lib/payments/`): `getAdapter(artist)` returns Stripe or Square implementation. `types.ts` defines `PaymentAdapter` interface with `createDepositLink` + `createGenericLink`. Stripe path wraps the existing SDK; Square path calls `/v2/online-checkout/payment-links` via raw fetch (no new dependency). `readArtistPaymentConfig()` parses raw artist row into typed config.
- **Renamed routes** to be provider-agnostic: `POST /api/bookings/[id]/deposit-link` (was `/stripe-payment-link`) and `POST /api/payments/payment-link` (was `/api/stripe/payment-link`). Both dispatch through the adapter. Old Stripe-specific routes deleted.
- **Square webhook**: new `POST /api/webhooks/square/[artistId]` verifies HMAC-SHA256 signature against `notification_url + body`, listens for `payment.created` / `payment.updated` events with `COMPLETED` status. Looks up the booking via `reference_id` on the Square order (set when the payment link is created).
- **Shared deposit-received helper** (`lib/payments/deposit-received.ts`): both webhooks call `handleDepositReceived()` for the side effect — mark `deposit_paid`, advance `sent_deposit → sent_calendar`, fire saved `sent_calendar` email with scheduling URL, push SSE event. Helper writes to both new generic columns (`deposit_external_id`) and legacy `stripe_payment_id` for backward compat.
- **Generic deposit columns on bookings**: `deposit_link_url`, `deposit_external_id`, `payment_provider` (per-row tag). New code reads/writes these; legacy `stripe_payment_link_url` / `stripe_payment_id` stay populated by the Stripe path. Migration backfills legacy data into the new columns.
- **Settings UI rebuilt** (`ExternalApiSettings.tsx`): tabbed Stripe / Square panel with "Active" / "Saved" badges. Saving credentials in either tab also flips `payment_provider`. Each tab has its own webhook section with the per-artist webhook URL to paste into the provider's dashboard. Step-2 flash on first save, "Don't show tips" coachmark explains the choice.
- **Consumer components rebranded**: `hasStripe` prop replaced with `paymentsConnected` + `paymentProvider` throughout PipelineView, BookingCard, BookingsTable, AcceptModal, SendDepositModal, LinksView. Provider-aware copy via `providerLabel` const ("Square will auto-advance when paid", "Generate Square link", etc.). AcceptModal's deposit-mode toggle goes from "stripe" to generic "provider" mode.
- **Setup guide** ([app/setup/page.tsx](app/setup/page.tsx)): "Connect Stripe or Square for automated deposits" replaces the Stripe-only step. Note nudges first-timers: *"Already use one? Connect it. Don't have either? Stripe is the easier setup for most artists."* Recommended Tools grid adds a Square card alongside Stripe.
- **Tooltips updated**: dashboard pipeline `HelpTooltip` and PipelineView coachmarks all say "payment provider" / "Stripe or Square" instead of Stripe-specific copy.
- **Analytics simplified**: removed all Stripe-specific sections (Stripe Payments card, Recent Payments table, Stripe area on revenue chart, Outstanding/Conversion link metrics) and the Stripe API hydration in `app/analytics/page.tsx`. Booking-derived metrics (revenue, conversion, distributions) still work. Provider-specific analytics will be revisited as a unified payments dashboard later.
- **Privacy** ([app/privacy/page.tsx](app/privacy/page.tsx)): Square added to the third-party processor list and integration credentials section.

### Session — Polish, Email Threading & UX Fixes (2026-04-26)
- **Email threading**: notification emails now thread in the client's inbox using RFC 2822 `In-Reply-To` / `References` headers via Resend `headers` field. Every outgoing email gets a `Message-ID`; the first email's ID is stored in `bookings.thread_message_id`; subsequent state-transition emails reference it. Manual compose ("Follow Up", reject) and scheduling confirmation emails are excluded — those may be conversational. New `THREADING_STATES` set in `lib/email.ts`. Migration: `20260426_email_threading.sql`.
- **Default form fields — select type**: size and placement fields now default to `select` type to showcase different field types. Artists who hadn't customized these fields get updated via migration `20260426_form_fields_select_defaults.sql`.
- **Richer seed data**: `deploy/seed-demo.mjs` — every booking now has `size`, `placement`, `budget`, `reference_urls`; state names corrected to pipeline v2 values; removed stale `accepted` + `ideal_date` fields; added `rejected` example.
- **Sent Deposit card**: replaced small "Awaiting payment…" text with a prominent pill ("Stripe will auto-advance when paid") in primary tint. Removed "Copy deposit link" button — link is still on the modal.
- **View client scroll-to-row**: "View client" from BookingCard now scrolls and expands the matching client row in the Clients table. `ClientsTable` uses a `rowRefs` Map + `requestAnimationFrame` + `scrollIntoView({ behavior: "smooth", block: "center" })` keyed on email. URL search param `?expand=email` triggers the effect.
- **New booking from client view**: `AddBookingModal` adds a "Send them the form" primary option with the form URL pre-filled with name/email/phone (Copy link, mailto, and Preview form actions). Manual entry is collapsible ("Or add it manually instead"). Booking page reads `?name=&email=&phone=` and passes them as `prefill` to `InquiryForm` defaultValues.
- **Pipeline tooltip update**: removed "Accepted" stage row; added note that booking moves to Booked automatically when client picks a time; reformatted as per-stage rows with bold labels for readability.
- **Coachmark viewport clamping**: Coachmark `top` clamped to `[12, vh - cardHeight - 12]`; card gets `max-h-[80vh] overflow-y-auto` for very tall tip content.
- **HelpTooltip viewport clamping**: `top` now clamped the same way — `Math.max(EDGE, Math.min(rawTop, vh - ph - EDGE))` — so the `?` tooltip near the top of the screen no longer clips above the viewport.
- **Phone formatting**: new `lib/format.ts` `formatPhone()` normalizes any stored phone string to `(NXX) NXX-XXXX`. Applied to display in BookingCard, BookingsTable, ClientsTable, PastClientsTable.
- **"Accepted" label cleanup**: `StateBadge`, `BookingCard` STATE_LABELS, `ClientsTable` STATE_LABEL, and the dashboard `HelpTooltip` pipeline list all now show "Deposit Pending" for legacy `accepted` rows instead of "Accepted".

### Session — Pipeline Cleanup, Bookings Consistency & Email UX (2026-04-26)
- **Removed "accepted" stage**: pipeline is now 6 stages — Submission → Follow Up → Sent Deposit → Sent Calendar → Booked → Completed. Accept action goes directly to Sent Deposit; no intermediate holding state. Legacy `accepted` DB rows folded into Sent Deposit in all UI views.
- **DB enum gap fixed**: `sent_deposit`, `sent_calendar`, `booked` added to `booking_state` enum via `20260425_remove_accepted_state.sql`. Must be run in two steps in Supabase SQL editor (ALTER TYPE first, UPDATE separately — Postgres transaction constraint).
- **Bookings table / Dashboard consistency**: "Booked" tab now folds in legacy `confirmed` rows (same as dashboard pipeline). `sent_deposit` tab folds in legacy `accepted` rows. Counts and tab filters updated throughout.
- **Reschedule email**: `update_appointment` already emailed client + artist on date change; wired up Reschedule button in bookings table for `booked` state (was only showing for `confirmed`/`accepted`). `handleAppointmentConfirmed` now sets state to `booked` (not the legacy `confirmed`) on new confirmations.
- **Calendar deduplication**: `/api/calendar/events` now includes `booked` state bookings (was `confirmed` only). When Google Calendar is connected, bookings with a `google_event_id` are suppressed from the amber FlashBooker list (they already appear as blue Google events) — eliminates duplicate entries.
- **SendDepositModal**: defaults to `accepted` email template (was falling back to `all[0]` which could be inquiry/submission). Template dropdown is now controlled (shows active selection). Existing `stripe_payment_link_url` on the booking surfaces as a "Previously generated link" with a Copy button above the generate-new field.
- **Rich email editor in all modals**: `SendDepositModal` and `SendCalendarModal` now use the same Edit/Preview toggle + variable chips as the Follow Up / Reject compose modal. `BodyPreview` exported from `EmailComposeModal` for reuse.
- **AddBookingModal status list** updated to reflect the 6-stage pipeline (removed Accepted, added Sent Deposit / Sent Calendar / Booked).

### Session — Pre-Deploy Prep, Tooltip Flip, Scheduling Buffers + Half-Day (2026-04-25)
- **Deployment toolkit** in new `deploy/` directory: `DEPLOYMENT_CHECKLIST.md` (all 14 env vars from grep, 46 migrations, RLS table list, Vercel cron + safe-paths audit, smoke-test plan), `preflight.sh` (env presence, secret-leak scan in `components/` and `'use client'` files, `NEXT_PUBLIC_*` naming check, lint, tsc, build, `.next/static` bundle scan for `service_role`/`sk_live_`/encryption-key shapes, `vercel.json` cron sanity, middleware safe-path audit), `api-smoke.sh` (middleware redirects, public artist routes, `/api/bookings` validation, every `/api/artist/*` GET unauth check, admin endpoint gating, cron auth with/without `CRON_SECRET`, Stripe webhook signature enforcement, scheduling slots/request validation, security header probe), and `seed-demo.mjs` (one-shot mock data seeder for demo accounts).
- **BLOCKER discovered: pipeline v2 enum gap.** `lib/types.ts` and `lib/email.ts` use state names `sent_deposit`, `sent_calendar`, `booked` but no migration adds them to the Postgres `booking_state` enum (writes would fail with `22P02`). Documented in deploy checklist with the SQL to add. Demo seeder maps to existing values (`deposit_sent`/`paid_calendar_link_sent`/`confirmed`) until the migration ships.
- **Demo data seeded** for `chris.cho.30+2@gmail.com` — 14 bookings spanning all 7 pipeline stages with realistic tattoo descriptions, varied placements/budgets, future + past appointments, tips and completion notes on Completed rows. Seeder is idempotent (deletes prior rows by demo email before insert).
- **HelpTooltip cutoff fix**: tooltip used to always render below the trigger and rely on a tiny `maxHeight` scrollbox when near the viewport bottom. Rewritten to mirror Coachmark's measure-then-flip logic — `useLayoutEffect` measures the panel after mount, flips above when there's not enough room below and above has more, computes `left = btnCenter - panelWidth/2` then clamps to `[12, vw - panelWidth - 12]` directly (dropped the `transform: translateX(-50%)` + center-clamp trick). Arrow `arrowLeft` is computed inside the (possibly clamped) panel so it stays under the `?` button; arrow border sides flip for top vs bottom placement. Re-measures on scroll/resize while open. First paint is hidden until `pos` is computed.
- **Scheduling links — buffer time**: per-link `buffer_minutes` (0 / 15 / 30) pill picker. Slots route inflates the END of every busy block by `buffer_minutes` before overlap checks. Applies to both Google freeBusy busy intervals AND FlashBooker DB bookings.
- **Scheduling links — half-day mode**: per-link `is_half_day` toggle. When on, hides the regular duration select and shows: `half_day_minutes` (3/4/5/6 hrs) and `half_day_followup_minutes` multi-select chips of allowed follow-up durations (using the existing 1–4 hr DURATIONS list). Slots route generates one half-day slot at `start_hour` plus follow-up slots after `half_day_minutes + buffer` for each allowed follow-up duration. Empty follow-up list = the rest of the day closes once a half-day is booked.
- **DB bookings now factor into busy intervals** in slots route — pulled per day, treated as `[appointment_date, appointment_date + duration]`. Buffer/conflict checks now work even when artist isn't syncing FlashBooker bookings to Google.
- **Default confirmation message**: new `DEFAULT_CONFIRMATION_MESSAGE` constant in `lib/pipeline-settings.ts`; `newLinkDraft()` initializes `confirmation_message` to it (rather than empty string), and the textarea placeholder shows the same default text — same pattern as the email template defaults.
- **Links page polish**: `Full-day sessions` header bumped from `text-xs` → `text-sm` (and description body to `text-sm`); helper paragraph above the link list now has an extra blank line between its two sentences. Add and Edit forms refactored to share a `LinkFormFields` component (cut ~120 lines of duplication).

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
