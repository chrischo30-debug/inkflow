-- Store the Message-ID of the first client email per booking for thread continuity
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS thread_message_id TEXT;
