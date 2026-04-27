-- Square integration alongside existing Stripe support.
-- Artists can pick one provider at a time via payment_provider.
-- Per-booking deposit link + external payment id become provider-agnostic
-- (stripe_payment_link_url / stripe_payment_id remain as legacy backfill source).

-- Run this ALTER block first.
ALTER TABLE artists ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS square_access_token text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS square_webhook_signature_key text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS square_location_id text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS square_environment text DEFAULT 'production';

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_link_url text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_external_id text;

-- Then run these UPDATEs separately (in a second SQL editor run) so the
-- new columns are visible to the planner.
UPDATE artists
   SET payment_provider = 'stripe'
 WHERE stripe_api_key IS NOT NULL
   AND (payment_provider IS NULL OR payment_provider = '');

UPDATE bookings
   SET deposit_link_url = stripe_payment_link_url
 WHERE stripe_payment_link_url IS NOT NULL
   AND deposit_link_url IS NULL;

UPDATE bookings
   SET deposit_external_id = stripe_payment_id
 WHERE stripe_payment_id IS NOT NULL
   AND deposit_external_id IS NULL;

UPDATE bookings
   SET payment_provider = 'stripe'
 WHERE stripe_payment_link_url IS NOT NULL
   AND payment_provider IS NULL;
