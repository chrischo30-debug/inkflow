-- Step 2: Migrate existing rows and add completion columns.
-- Runs in a separate transaction so the new enum values from the previous
-- migration are already committed and safe to use in DML.

UPDATE bookings SET state = 'accepted'::booking_state         WHERE state = 'reviewed';
UPDATE bookings SET state = 'paid_calendar_link_sent'::booking_state WHERE state = 'deposit_paid';

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount      numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tip_amount        numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completion_notes  text;
