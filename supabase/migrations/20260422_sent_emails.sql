-- Track individual emails sent per booking for history display
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sent_emails JSONB DEFAULT '[]'::jsonb;
