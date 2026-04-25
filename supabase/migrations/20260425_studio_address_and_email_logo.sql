alter table artists
  add column if not exists studio_address       text,
  add column if not exists email_logo_enabled   boolean default true,
  add column if not exists email_logo_bg        text    default 'light', -- 'light' or 'dark'
  add column if not exists auto_emails_enabled  boolean default true;     -- master kill-switch for all automatic emails
