# FlashBooker — Manual Test Plan

Run this against `npm run dev` on `http://localhost:3000` before any prod deploy. Each section has: prerequisites, steps, expected outcome, "RED FLAG" failures that should stop the deploy.

Use a test artist account for everything. Don't run mutating tests against an account with real client data.

---

## A. Auth flows

### A1. Sign up a new test artist
- Go to `/signup`. Fill in email + password. Submit.
- **Expected:** redirect to `/onboarding?step=...` (middleware detects placeholder `Artist XXXXXX` name + `artist-XXXXXXXX` slug).
- **RED FLAG:** lands you on dashboard with no onboarding, OR shows a 500.

### A2. Onboarding
- Step 1: name + slug. Slug should validate uniqueness (try a duplicate, expect inline error).
- Step 2: deposit amount, optional fields.
- Step 3: reply-to email (gmail_address). Save.
- **Expected:** lands on dashboard `/`.
- **RED FLAG:** middleware loops back to onboarding after submit.

### A3. Logout / login
- Click logout. Should land on `/login`.
- Log in with the same credentials. Should land on `/`.

### A4. Forgot password
- Logout. Click "Forgot your password?" on `/login`.
- Enter your email. Submit.
- **Expected:** confirmation message + email arrives (check Resend dashboard if local — should hit the mock fallback in dev unless `RESEND_API_KEY` is real).

---

## B. Public artist surface

### B1. Public booking page renders
- Visit `http://localhost:3000/<your-slug>/book` (logged out — open incognito if needed).
- **Expected:** branded page with form fields, accent color applied, your studio name.
- **RED FLAG:** 404, blank page, or middleware redirects you to `/login`.

### B2. Submit a booking
- Fill the form. Use a test client name + email. Add a tattoo description. Optional: upload a reference image.
- Submit.
- **Expected:** confirmation page; booking row appears in your dashboard at `/`; client receives an inquiry confirmation email (or mock log in dev).
- **RED FLAG:** form submit returns 500; submission lands but no confirmation page; no email logged.

### B3. Public contact page
- Visit `/<slug>/contact`. Fill + submit.
- **Expected:** confirmation message; row appears in `/admin` contact submissions or settings → contact submissions.

### B4. Public newsletter page
- Visit `/<slug>/newsletter`. Subscribe.
- **Expected:** confirmation. (If Kit is configured per-artist, subscriber syncs to Kit; otherwise just stored locally.)

### B5. Books-closed mode
- In settings, toggle Books Closed.
- Reload `/<slug>/book` in incognito.
- **Expected:** closed-books page renders (newsletter form if enabled).
- Toggle back on.

---

## C. Dashboard & pipeline

### C1. Dashboard action cards
- Visit `/`. With at least one inquiry from B2, the "New inquiries" card should show count > 0.
- **TABLET CHECK:** Resize browser to 800px wide (iPad portrait). Cards should be 2-col, not 3-col. (We just fixed this.)

### C2. Booking detail expand
- Click a booking card. It should expand inline showing description, references, etc.
- Click again to collapse.

### C3. Pipeline view
- Visit `/bookings`. Switch to the Pipeline tab.
- **Expected:** kanban with 6 columns (Submission → Follow Up → Sent Deposit → Sent Calendar → Booked → Completed).
- **Drag-drop:** try dragging a card between columns on desktop. **Note:** iPad won't support drag-drop — that's expected; tablet uses the overflow menu.

### C4. Move via overflow menu
- Click the ⋯ on a booking card. Click "Move to..." → pick a stage.
- **Expected:** card moves; if email is configured for that stage, the compose modal pops with the template pre-filled.

### C5. Reorder within a column
- Drag a card up/down within the same column.
- Refresh the page.
- **Expected:** order persists. If it snaps back, the reorder API is broken.
- **RED FLAG:** reorder appears to work but doesn't persist after refresh.

---

## D. Pipeline transitions + emails (the most important)

For each transition below: trigger it, watch for the compose modal (if applicable), send the email, verify the booking advances.

Run with mock email mode (no real `RESEND_API_KEY`) the first time so emails just log to the dev console. Then with real key once you're confident.

### D1. Submission → Follow Up
- Pick a card in Submission. Click ⋯ → "Move to Follow Up".
- Compose modal pops (template includes `REPLACE THIS` markers — must be edited).
- Replace the markers, send.
- **Expected:** card moves to Follow Up; sent_emails entry recorded; preview email logged.

### D2. Submission → Sent Deposit
- Pick another submission card. Click "Send deposit" / accept flow.
- AcceptModal pops. Pick a deposit link (need at least one in Settings → Payment Links — see G1).
- Compose modal pops. Send.
- **Expected:** card moves to Sent Deposit; client gets the email with the deposit link.

### D3. Sent Deposit → Sent Calendar (manual)
- Pick a Sent Deposit card. Click "Send calendar".
- Compose pops with scheduling link template. Send.
- **Expected:** moves to Sent Calendar.

### D4. Sent Deposit → Sent Calendar (Stripe webhook auto-advance)
- This requires Stripe configured and a real test payment OR a CLI-fired webhook event. Save for Step 6 against preview deploy. Note as a known gap on local.

### D5. Sent Calendar → Booked
- The artist's client picks a slot via the public scheduling link. (See E1 below.)
- Or manually: ⋯ → "Move to Booked", appointment date input modal appears. Set a date.
- **Expected:** moves to Booked; calendar event created in Google Calendar (if connected — see F).

### D6. Booked → Completed
- Click "Mark Complete" on a Booked card.
- Completion modal pops. Enter total amount, tip, notes; optionally upload completion photos.
- **PERSISTENCE CHECK:** type something in the notes field, refresh the page, reopen the same card's completion modal. The notes you typed should still be there. (We just shipped this; verifying it works is critical.)
- Save. **Expected:** moves to Completed; total/tip/notes saved.
- **RED FLAG:** notes don't persist on refresh — our localStorage hook is broken.

### D7. Email compose draft persistence
- Open any compose modal (e.g. via D1). Type a custom edit into the body. **Don't send.** Refresh the page.
- Reopen the same compose modal (same booking, same target state).
- **Expected:** your edit is still there.
- **RED FLAG:** edit lost.

### D8. Cancellation
- Click ⋯ → Cancel on a Sent Deposit card.
- Confirm dialog. **Expected:** moves to a Cancelled state (or hidden). Verify the booking is no longer in pipeline view.

---

## E. Scheduling links

### E1. Create a scheduling link
- Settings → Scheduling Links → Add. Name it, set duration (e.g. 2 hours), set buffer minutes, enable.
- Copy the public link.

### E2. Public scheduling picker
- Open the public link in incognito. Pick a date, then a slot.
- **Expected:** confirmation message renders; booking advances to Booked (or whatever the link is configured to do); calendar event created if Google connected.
- **RED FLAG:** all slots show as available even though Google Calendar shows you're busy that day → freeBusy isn't working (could be Google not connected, or env var issue).

### E3. Half-day mode
- Edit a scheduling link. Enable `block_full_day`.
- Pick a slot via the public link.
- Try to pick another slot the same day in incognito.
- **Expected:** entire day is blocked.

### E4. Manual blocked dates
- Settings → Blocked Dates → add a date.
- Try to pick that date via the public scheduling link.
- **Expected:** blocked.

---

## F. Google Calendar integration

### F1. Connect Google
- Settings → Google Calendar → Connect.
- OAuth flow opens. Authorize.
- **Expected:** redirects back, shows "Connected as <email>".
- **RED FLAG:** redirect URI mismatch error from Google → `GOOGLE_REDIRECT_URI` doesn't match what's registered in Google Cloud Console.

### F2. Pick a calendar
- After connecting, the artist picks which of their calendars to write to (and which to read for free/busy).

### F3. Verify event creation
- Trigger D5 (move a booking to Booked with an appointment date).
- Open Google Calendar. **Expected:** event appears.

### F4. Disconnect / reconnect
- Disconnect. Connect again.
- **Expected:** roundtrip works without errors; encrypted refresh token re-saved.

---

## G. Payments (Stripe — skip if not using)

### G1. Add a Stripe key
- Settings → Payments → Stripe → paste a `sk_test_...` key + webhook secret.
- **Expected:** save succeeds; "Connected" indicator.

### G2. Add a payment link
- Settings → Payment Links → Add. Choose Stripe; set amount.
- The system generates a Stripe Payment Link via the API.

### G3. Use the deposit-link flow
- Trigger D2 against a booking, sending the Stripe deposit link in the email.
- (For a full webhook test — wait for preview deploy, Step 6.)

---

## H. Other settings pages (smoke test each)

Each of these screens should: (a) load without 500, (b) save changes that round-trip on refresh.

- Settings → Form Builder
  - **PERSISTENCE CHECK:** start authoring a new custom field. Type a label, change the type to "select", add 3 options. **Don't save.** Refresh the page. Reopen "Add custom field". Your draft should restore. (We just shipped this.)
- Settings → Email Templates → edit the Inquiry template subject. Save. Refresh. Confirm.
- Settings → Booking Page → change accent color, upload a logo (small image is fine), save.
- Settings → Contact Form → toggle on, set fields, save.
- Settings → Newsletter (Kit) → if you have Kit, paste keys; otherwise just verify the screen renders.
- Settings → Pipeline (auto-emails toggle) → toggle off, transition a booking, confirm no email sent. Toggle back on.
- Settings → Books → toggle open/closed.
- Settings → Account → change name, save.

---

## I. Calendar view

- `/calendar` — should show events for the current month. Confirmed bookings appear; manually-added Google events appear if synced.

---

## J. Past clients / Analytics

- `/past-clients` — list of completed clients; search box works.
- `/analytics` — revenue chart, popular request types, etc. should render with whatever data you have.

---

## K. Reminders cron (manual trigger)

- With a confirmed/booked booking that has an appointment date in the next 24 hours:
- Curl your local cron endpoint with the secret:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/reminders/send
  ```
- **Expected:** `{ sent: N, ... }` JSON; reminder email logged.
- Without the auth header: should 401.

---

## L. Edge cases

### L1. Network failure during reorder
- Open browser devtools → Network → throttle to "Offline". Drag-reorder a card.
- **Expected:** order shows the new position optimistically. Re-enable network. Refresh.
- **GAP:** per `OPTIMIZATIONS.md` P1-5, reorder has no error recovery — the card may snap back without a toast. Note this; it's a P1 cleanup item, not a launch blocker.

### L2. Refresh during email compose
- Cover in D7.

### L3. Drag-drop on touch
- Open Safari Responsive Design Mode → iPad. Try to drag a pipeline card.
- **Expected:** drag doesn't work on touch. Use the ⋯ "Move to..." fallback.

---

## Outcome

Walk through sections A → K in order. For each section, mark as PASS / FAIL / SKIP, and note any FAILs. We can fix or accept each FAIL as we go.

A section marked SKIP (e.g. Square because you're using Stripe) is fine. A section FAIL needs a triage call: blocking, post-launch fix, or accepted edge case.

Once everything you intend to run hits PASS or accepted-FAIL, you've done your behavioral validation. Then we proceed to Step 3 (Supabase prod setup).
