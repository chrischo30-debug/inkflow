-- Books open/closed toggle and optional drop schedule
ALTER TABLE artists ADD COLUMN IF NOT EXISTS books_open boolean DEFAULT true;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS books_open_at  timestamptz;  -- optional: auto-open at this time
ALTER TABLE artists ADD COLUMN IF NOT EXISTS books_close_at timestamptz;  -- optional: auto-close at this time
ALTER TABLE artists ADD COLUMN IF NOT EXISTS books_closed_message text;   -- shown on the booking form when closed
