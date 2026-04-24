ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS booking_header_size text DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS booking_header_align text DEFAULT 'left';
