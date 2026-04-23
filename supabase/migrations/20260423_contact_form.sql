-- Contact form settings on the artist profile
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS contact_form_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_form_header TEXT DEFAULT 'Get in touch',
  ADD COLUMN IF NOT EXISTS contact_form_subtext TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_form_button_text TEXT DEFAULT 'Send Message',
  ADD COLUMN IF NOT EXISTS contact_form_confirmation_message TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_contact_on_closed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_phone_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_phone_required BOOLEAN DEFAULT false;

-- Store contact form submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS contact_submissions_artist_id_idx ON contact_submissions(artist_id);
