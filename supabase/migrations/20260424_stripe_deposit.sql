ALTER TABLE artists ADD COLUMN IF NOT EXISTS stripe_webhook_secret text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_link_url text;
