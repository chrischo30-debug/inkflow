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
- Deposit automation (auto-mark paid via Stripe webhook)
- Custom domain for booking form
- Instagram DM integration
