-- Add missing pipeline v2 enum values (sent_deposit, sent_calendar, booked).
-- These were referenced in code but never added to the DB enum.
ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'sent_deposit';
ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'sent_calendar';
ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'booked';

-- Migrate legacy "accepted" bookings to "sent_deposit".
-- The "accepted" stage is removed from the pipeline.
UPDATE bookings
SET state = 'sent_deposit'
WHERE state = 'accepted';
