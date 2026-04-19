# roadmap.md

## Phase 1 — Build Now

### Auth & Onboarding
- [ ] Email + password sign up and login
- [ ] Artist profile setup (name, studio, style tags, deposit amount)
- [ ] Onboarding flow: connect Google Calendar, set availability, configure first form

### Inquiry Form Builder
- [ ] Artist gets a unique public form URL (e.g. inkflow.app/book/[artist-slug])
- [ ] Form fields: name, email, phone, tattoo description, size, placement, reference images, budget
- [ ] Artist can toggle fields on/off and mark required
- [ ] Form submissions saved to DB and trigger pipeline entry

### Booking Pipeline (Kanban / List view)
- [ ] View all inquiries with current state (inquiry → reviewed → deposit_sent → deposit_paid → confirmed → completed)
- [ ] Move submissions through states manually or via automation
- [ ] Filter by state, date, client name
- [ ] "Needs action today" highlight — show what requires the artist's attention

### Automated Messaging
- [ ] Pre-written email templates for each pipeline state transition
- [ ] Artist can edit template text
- [ ] Auto-send on state change (configurable — artist can turn off per state)
- [ ] Manual send option — review before sending

### Payment Link Sending
- [ ] Artist stores their payment links (Stripe, Venmo, Cash App, Squarespace, etc.)
- [ ] One-click send deposit request email with their saved payment link embedded
- [ ] Payment link not sent until artist approves — enforced by pipeline state
- [ ] Mark deposit as paid manually (artist confirms receipt)

### Calendar View
- [ ] In-app calendar showing confirmed appointments
- [ ] Availability blocks — artist sets open slots
- [ ] Google Calendar two-way sync (read existing events, write confirmed bookings)
- [ ] Day and week view minimum

### Dashboard
- [ ] Today's appointments
- [ ] Pipeline summary (count per state)
- [ ] Unreviewed inquiries count
- [ ] Pending deposits (sent but not paid)

---

## Phase 2 — Not Building Yet
- [ ] Mobile app (iOS / Android)
- [ ] Multi-artist studio accounts
- [ ] In-app payment processing (Stripe Connect)
- [ ] SMS messaging (Twilio)
- [ ] Analytics (revenue, booking rate, drop-off by stage)
- [ ] Waitlist management
- [ ] Client portal (client can see their own booking status)
- [ ] Deposit automation (auto-mark paid via Stripe webhook)
- [ ] Custom domain for booking form
