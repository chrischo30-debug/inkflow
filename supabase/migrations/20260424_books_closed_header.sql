-- Allow artist to set a custom header/title on the closed books page
ALTER TABLE artists ADD COLUMN IF NOT EXISTS books_closed_header text;
