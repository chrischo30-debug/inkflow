-- Appointment reminder settings on artist
ALTER TABLE artists ADD COLUMN IF NOT EXISTS reminder_enabled boolean DEFAULT false;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS reminder_hours_before integer DEFAULT 24;

-- Track when a reminder was sent per booking (prevents double-sends)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
