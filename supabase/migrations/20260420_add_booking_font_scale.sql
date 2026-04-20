-- Add booking font scale setting to artists
ALTER TABLE artists ADD COLUMN IF NOT EXISTS booking_font_scale text DEFAULT 'base';
