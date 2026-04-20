alter table artists
  add column if not exists form_confirmation_message text,
  add column if not exists form_success_redirect_url text;
