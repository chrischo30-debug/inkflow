-- Stripe payment tracking fields added by the global payment link system
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_id text;
-- amount_paid stored in cents (integer) — matches Stripe's unit_amount convention
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paid integer;
-- payment_failed flag set when payment_intent.payment_failed fires
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_failed boolean DEFAULT false;
