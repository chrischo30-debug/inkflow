-- Pipeline v2: new states + fields
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS scheduling_link_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_source TEXT;
