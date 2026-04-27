# FlashBooker — Production Data Persistence Audit

What user state is currently kept only in memory or `localStorage`, vs what's safely round-tripped to Postgres. Audit done by reading every `useState` in `components/` + every `localStorage`/`sessionStorage` reference, then walking each settings/edit screen to verify it has a persist endpoint.

Severity:
- **CRITICAL** — data loss visible to the user (lost typing, lost work).
- **IMPORTANT** — lost preference / minor UX regression.
- **OK** — intentionally local; do not persist.

---

## CRITICAL — must fix before launch

### 1. Email compose modal — drafts evaporate on refresh
- **File:** [components/booking/EmailComposeModal.tsx:187-191](../components/booking/EmailComposeModal.tsx#L187-L191)
- **State:** `subject`, `body` held in `useState`. Modal closes on send, but if the artist refreshes / accidentally navigates away mid-compose, the entire body is gone. Some templated emails get edited heavily before sending.
- **Fix:** add a `booking_email_drafts` row keyed by `(artist_id, booking_id)`; debounce-save on keystroke (~500ms); load on modal open; delete on send. Or accept the loss explicitly and warn before close — but don't ship as-is silently.

### 2. Booking completion modal — payment + notes can be lost
- **Files:** [components/booking/BookingsTable.tsx:196](../components/booking/BookingsTable.tsx#L196), [components/booking/PipelineView.tsx:98](../components/booking/PipelineView.tsx#L98)
- **State:** `total_amount`, `tip_amount`, completion notes, **and the upload-pending image queue** held in component state until the artist hits Save. A mid-completion crash or refresh wipes it. The image upload queue is the worst part — those files are already in the browser and not persisted anywhere.
- **Fix:** persist as draft on the existing `bookings` row (`completion_draft jsonb`) or a sibling `booking_completion_drafts` table. For images, upload to storage as soon as picked (under a `drafts/` prefix), not on Save.

### 3. Custom form-field editor — long drafts vaporize
- **File:** [components/settings/FormBuilderSettings.tsx:147-156](../components/settings/FormBuilderSettings.tsx#L147-L156)
- **State:** new custom field being authored (label, type, options list, placeholder) lives in `useState` until the artist clicks Save. With 10+ option fields this is meaningful typing.
- **Fix:** auto-save the work-in-progress to a `form_field_drafts` table keyed by `(artist_id, draft_key)` or even sessionStorage with a banner ("you have an unsaved draft"). Cheap option: stop using a single in-memory draft and instead Save-Then-Edit so each field is persisted from creation.

---

## IMPORTANT — should fix soon

### 4. Pipeline reorder has no error recovery
- **File:** [components/booking/PipelineView.tsx:52-63, 285-288](../components/booking/PipelineView.tsx)
- **Behavior:** drag-drop fires `POST /api/bookings/reorder` optimistically. If that request fails (network blip, 401), the UI keeps the new order in memory until the next refresh, then snaps back — silent regression.
- **Fix:** check the response; on failure show a toast + roll back the optimistic update. Or queue the reorder in localStorage and retry on next focus.

### 5. Booking edit form (inline edits inside booking detail)
- **Worth a one-pass walkthrough.** Several fields (description, notes, appointment date, deposit amount) get edited in modals scattered across [components/booking/](../components/booking/). Verify each Save button POSTs and that the response is awaited before the modal closes. The patterns differ by file — easy place for a regression.

### 6. Onboarding (multi-step) progress
- **File:** [app/onboarding/](../app/onboarding/)
- **Behavior:** middleware detects placeholder name/slug to send the artist back to onboarding. But within onboarding, if the artist fills step 2 and refreshes, do they snap back to step 1 or resume? Confirm before launch — easy silent UX regression.

---

## OK — confirmed correctly local

These were checked and **should stay local**, per the project memory:

| State | Storage | Why this is correct |
|-------|---------|---------------------|
| Sidebar collapse | localStorage + cookie ([components/layout/SidebarNav.tsx:97](../components/layout/SidebarNav.tsx#L97)) | UI preference, cookie used for SSR-hint to avoid layout flash |
| Sidebar scroll position | sessionStorage | Transient, expected to reset across sessions |
| Coachmark "seen" flags | localStorage `fb_coachmarks` | Per project memory: intentional. Re-seeing tips on a new device is fine. |
| Add-Booking modal form | useState | Modal is transient; closing without submit is the explicit "cancel" path |
| Theme accent color | useState then immediate PUT to `/api/artist/theme` | Already round-trips; no issue |

---

## What to add before launch

A single migration:
```sql
-- 20260427_drafts.sql
CREATE TABLE booking_email_drafts (
  artist_id uuid NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  subject text,
  body text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (artist_id, booking_id)
);
ALTER TABLE booking_email_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_email_drafts_owner ON booking_email_drafts
  USING (artist_id = auth.uid()) WITH CHECK (artist_id = auth.uid());

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS completion_draft jsonb;
```
Plus a debounced `PUT /api/bookings/[id]/email-draft` endpoint and a load on modal mount. ~2 hours of work.

If you want to ship Phase 1 without this, **explicitly tell users that compose modals are transient** ("Drafts aren't saved yet — copy your text before refreshing"). Silent data loss is the launch-killer here.
