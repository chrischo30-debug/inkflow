# FlashBooker — Landing Page Brief

A factual, copy-paste-ready brief to feed Claude (or a designer) when generating a marketing landing page. Everything below is grounded in the actual codebase — features only listed if the route or component exists today.

---

## What it is, in one sentence

FlashBooker is a booking and pipeline tool for tattoo artists: a public intake form for clients, a kanban-style booking pipeline for the artist, and integrated payments + calendar + automated email so a tattoo studio can run its bookings without spreadsheets, DMs, or Calendly.

## Who it's for

- **Independent tattoo artists** running their own books (not multi-chair studios — single artist, multi-tenant by design).
- Use case: an artist takes 5–30 booking inquiries a week, runs each through accept → deposit → schedule → confirm → tattoo → completed, and wants this off Instagram DMs and Google Forms.
- Working primarily on an iPad in the studio between clients.

## The before-state we replace

- Instagram DMs collecting requests with no organization
- A spreadsheet of names + phone numbers
- Venmo screenshots as proof of deposit
- Calendly for scheduling, separate from inquiries
- Manual email replies copied from Notes
- Google Calendar entries the artist updates by hand

## Core features (only what's actually built)

### For clients (the artist's customers)
- **Public booking page** at `/<artist-slug>/book` — fully customizable form fields (artists add their own questions like "where on the body" or "preferred dates"), reference image upload (up to 8 images, 5MB each), accent color and background image branding, light/dark mode.
- **Public contact form** at `/<artist-slug>/contact` for general questions.
- **Public newsletter signup** at `/<artist-slug>/newsletter` (or auto-shown when books are closed) — embeds the artist's Kit (formerly ConvertKit) form natively.
- **Self-serve scheduling** at `/schedule/<artistId>/<linkId>` — artists send a link, the client picks a date+slot from real Google-Calendar-aware availability, and the booking auto-confirms (no back-and-forth).
- **Books-closed mode** — artist can flip a switch and the booking page swaps to a closed-books message with optional newsletter capture.

### For the artist (the dashboard)
- **6-stage booking pipeline** (kanban view + table view): Submission → Follow Up → Sent Deposit → Sent Calendar → Booked → Completed.
- **One-click email composer per stage** — every transition has a customizable email template with placeholders ({clientName}, {paymentLink}, {calendarLink}, etc.). Artist can edit the template in settings or tweak per-send. Emails thread automatically by Message-ID.
- **Reply-To routing** — emails go out as "{Artist} via FlashBooker <bookings@flashbooker.app>" but replies route to the artist's personal email.
- **Stripe and Square integration** — artist connects their own payment account; deposit links are generated from inside the booking; webhooks auto-advance the pipeline when paid.
- **Google Calendar sync** — bookings appear on the artist's primary calendar; availability is checked via real free/busy.
- **Per-link scheduling availability** — half-day mode, buffer minutes between appointments, manual blocked dates, custom confirmation messages per scheduling link.
- **Reference image gallery** — every inquiry's reference photos sit on the booking card.
- **Completion tracking** — final price, tip, post-tattoo photos, all stored on the booking row.
- **Past clients view** — searchable client history pulled from completed bookings.
- **Webhook ingress** — artist can connect Typeform / Jotform / Zapier and have those forms create bookings via per-source webhook tokens.
- **Custom contact form** for non-booking questions, stored separately.
- **Newsletter integration** with Kit (form embed + subscriber capture).
- **Analytics dashboard** — revenue by month, popular request types, booking velocity.
- **Setup guide** — tiered (Required / Recommended / Power) — walks new artists through everything from setting their slug to hooking up Stripe.

### Automation
- **Hourly reminder cron** sends appointment reminders X hours before the booking (configurable per artist).
- **Inquiry auto-email** — instant confirmation back to the client when a form is submitted.
- **Coachmark system** — guided in-product tooltips that appear once and stick to localStorage.
- **Email branding** — artist's logo embedded in every transactional email, light or dark background to match.

### Admin (for FlashBooker operator)
- **Superuser admin panel** at `/admin` — list all artists, "Access Account" via server-side OTP exchange (impersonate without password), reset password, delete account.

## User journeys (3 to highlight)

**Journey 1 — Client books an appointment.**
1. Client opens `/<artist>/book` from the artist's Instagram bio.
2. Fills out the form — name, email, what they want, references, preferred dates.
3. Submits → instantly receives a confirmation email saying "Got it, I'll reply in 24 hours."
4. Two days later, gets a personal email from the artist saying yes + here's a deposit link.
5. Pays $50 via Stripe; pipeline auto-moves to Sent Calendar. Client receives the scheduling link.
6. Picks a Saturday slot from real availability; booking confirmed; appointment lands on the artist's Google Calendar.
7. 24 hours before, client gets an automatic reminder email.

**Journey 2 — Artist runs Tuesday admin time.**
1. Opens iPad, logs into FlashBooker.
2. Dashboard shows 8 new submissions, 3 deposits owed, 2 reminders sent today.
3. Drags 4 inquiries from Submission → Follow Up. Composes a quick reply on each (template auto-fills).
4. Two clients have paid deposits since last login — pipeline already moved them; she just sends the scheduling link with one tap.
5. One booking needs a date change — she edits from the card, calendar event re-syncs.
6. Closes the laptop. Total: 15 minutes for what used to take an hour.

**Journey 3 — Artist closes books for a month.**
1. Goes to Settings → Books → flips "Books closed."
2. Public form is replaced with a friendly message + newsletter signup.
3. Existing inquiries stay in the pipeline; existing bookings still happen.
4. A month later, flips it back. Subscriber list captured during the closure is in the artist's Kit account.

## Visual / brand cues

- Tone: casual, warm, no hype phrases, no em dashes (per project copy guideline).
- Primary surface looks like a kanban board with portrait booking cards.
- Accent color is per-artist on the public booking page; the dashboard uses a neutral, high-contrast palette.
- Solid text colors on solid backgrounds; never `text-*-variant/50` or other opacity tricks (per design memory).
- Public booking page works as a brandable "site" — artists pick accent + background image + logo.

## Stats / facts to use as proof

(Pull these from the actual code/migrations as ground truth.)

- 49 SQL migrations shipped.
- 51 API routes covering bookings, scheduling, payments (Stripe + Square), calendar, contact, newsletter, admin.
- 6-stage pipeline (after pipeline-v2 — `accepted` was removed because it was redundant).
- Two payment providers supported via a clean adapter (one-of-two model — artists pick Stripe OR Square, not both).
- Google Calendar OAuth with AES-256-CBC encrypted refresh tokens at rest.
- Email sender format follows Reply-To best practice: `"Artist via FlashBooker" <bookings@flashbooker.app>`, Reply-To = artist's real email.
- Hourly reminder cron, configurable per artist.
- Coachmark / guided tooltip system anchored to data attributes — lets us teach the product without docs.
- Tablet-first design: html base 17px, large touch targets, overflow menus that portal correctly to escape clipping containers.
- Multi-tenant via Postgres RLS — every row scoped by `artist_id`.

## What we are explicitly NOT

- Not a marketplace (we don't list artists publicly or take commissions on bookings).
- Not multi-chair / multi-artist studio software.
- Not a CRM (no lead scoring, no pipelines for non-tattoo work).
- Not an AI sales agent (no auto-replies generated by an LLM).
- Not a payment processor (Stripe and Square do that; artist's account, artist's money).

## Headline candidates

(Pick one or write your own — don't ship them all.)
- "Booking software, by a tattoo artist, for tattoo artists."
- "Stop running your books in DMs."
- "From inquiry to ink, in one app."
- "Your iPad is your front desk."

## Subhead

> A booking pipeline + scheduling + automated email, made for the way tattoo artists actually work.

## Sections the page should have

1. Hero (headline, subhead, screenshot of pipeline view, primary CTA "Start free")
2. Three-column "before / after" — DMs vs FlashBooker, spreadsheet vs FlashBooker, Calendly vs FlashBooker
3. Pipeline screenshot with annotated callouts (the 6 stages + auto-advance)
4. Public booking page screenshot (the artist's branded view) — emphasize "make it yours"
5. Integrations strip — Stripe, Square, Google Calendar, Kit, Resend
6. Automation explainer — what fires automatically vs what stays manual (artists are wary of "auto-replies")
7. Pricing (don't have copy yet)
8. FAQ (Stripe vs Square? what about cancellations? can my client pay over time? does it work on Android?)
9. Sign-up CTA

## CTAs to A/B

- "Start your booking page" (action-oriented)
- "Try free for 14 days" (no-friction)
- "See it in 60 seconds" (demo-first)

## Tone do/don't

- Do: "This was built because the alternative was a spreadsheet and a Linktree."
- Don't: "Revolutionizing the tattoo industry" / "AI-powered booking experience" / em dashes / multi-clause hype paragraphs.

---

This brief should be enough for Claude or a designer to draft a landing page in one shot. Pair with one screenshot of the pipeline view, one of the public booking page, and one of the iPad calendar view.
