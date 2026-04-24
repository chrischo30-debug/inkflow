# api-reference.md

All routes are in app/api/. All routes except /api/bookings/inquiries require authentication.

---

## Bookings

### POST /api/bookings/inquiries
Public — no auth required. Called by the public booking form.
Body: { artist_slug, client_name, client_email, client_phone?, tattoo_description, placement, size, budget?, reference_images? }
Returns: { booking_id } on success
Side effects: saves booking with state "inquiry", sends notification email to artist

### GET /api/bookings
Auth required. Returns all bookings for authenticated artist.
Query params: state? (filter by state), limit?, offset?
Returns: { bookings: Booking[] }

### GET /api/bookings/[id]
Auth required. Returns single booking by ID (must belong to artist).
Returns: { booking: Booking }

### PATCH /api/bookings/[id]/state
Auth required. Advances booking to next state.
Body: { state: BookingState }
Rules: state must follow valid transition order, enforced server-side
Side effects: fires auto-send email template if configured for that state transition
Returns: { booking: Booking }

### PATCH /api/bookings/[id]
Auth required. Updates booking fields (notes, appointment_at, etc.)
Body: Partial<Booking> — only whitelisted fields accepted
Returns: { booking: Booking }

---

## Messaging

### POST /api/messages/send
Auth required. Sends an email to a client.
Body: { booking_id, template_id?, subject?, body? } — either template_id or manual subject+body
Returns: { sent: true }

### GET /api/messages/templates
Auth required. Returns all email templates for artist.
Returns: { templates: EmailTemplate[] }

### PUT /api/messages/templates/[id]
Auth required. Updates a template.
Body: { subject?, body?, auto_send? }
Returns: { template: EmailTemplate }

---

## Calendar

### GET /api/calendar/events
Auth required. Returns upcoming events from Google Calendar + confirmed FlashBooker bookings.
Query params: start (ISO date), end (ISO date)
Returns: { events: CalendarEvent[] }

### POST /api/calendar/sync/[booking_id]
Auth required. Writes a confirmed booking to Google Calendar.
Returns: { google_event_id: string }

### GET /api/calendar/availability
Auth required. Returns artist's availability blocks.
Returns: { availability: AvailabilityBlock[] }

### PUT /api/calendar/availability
Auth required. Updates availability blocks.
Body: { availability: AvailabilityBlock[] }
Returns: { availability: AvailabilityBlock[] }

---

## Artists / Settings

### GET /api/artists/me
Auth required. Returns authenticated artist's profile.
Returns: { artist: Artist }

### PATCH /api/artists/me
Auth required. Updates artist profile and settings.
Body: Partial<Artist> — whitelisted fields only (not google_tokens)
Returns: { artist: Artist }

### GET /api/artists/[slug]
Public. Returns minimal artist info for booking form display.
Returns: { name, studio_name, bio, slug }

---

## Google OAuth

### GET /api/auth/google/connect
Auth required. Initiates Google Calendar OAuth flow.
Redirects to Google consent screen.

### GET /api/auth/google/callback
OAuth callback. Stores tokens and redirects to /dashboard/settings.
