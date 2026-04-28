-- Track when the auto-fired emails on a public booking submission failed.
-- Two emails fire on /api/bookings POST: the artist notification and the
-- client auto-confirmation. Either failing was previously silent (caller
-- used fire-and-forget). We now record the failure on the booking so the
-- artist sees a "email didn't send" badge on the inquiry card and can
-- follow up manually.
--
-- inquiry_email_failed is the flag the dashboard reads.
-- inquiry_email_error is a free-form snippet of the failure for debugging
-- (truncated at write time; safe to leave NULL on success).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS inquiry_email_failed BOOLEAN DEFAULT FALSE;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS inquiry_email_error TEXT;
