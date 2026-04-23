-- Kit (ConvertKit) integration and newsletter form settings
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS kit_api_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kit_form_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS newsletter_form_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS newsletter_form_header TEXT DEFAULT 'Stay in the loop',
  ADD COLUMN IF NOT EXISTS newsletter_form_subtext TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS newsletter_form_button_text TEXT DEFAULT 'Subscribe',
  ADD COLUMN IF NOT EXISTS newsletter_form_confirmation_message TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_newsletter_on_closed BOOLEAN DEFAULT false;
