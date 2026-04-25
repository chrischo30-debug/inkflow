ALTER TABLE artists ADD COLUMN IF NOT EXISTS scheduling_links jsonb DEFAULT '[]'::jsonb;
