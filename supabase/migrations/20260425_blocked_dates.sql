-- Global blocked dates per artist (holidays, days off, etc.)
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS blocked_dates JSONB DEFAULT '[]'::jsonb;
