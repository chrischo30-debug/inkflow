-- Track whether a client has replied via Gmail (unread thread) that the artist hasn't acted on yet.
-- has_unread_reply is set true by the sync-replies API when Gmail shows the thread as unread,
-- and cleared false when the artist sends an email or moves/advances the booking.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS has_unread_reply BOOLEAN NOT NULL DEFAULT false;

-- Reserved for future Stripe webhook integration to track deposit payment.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT false;
