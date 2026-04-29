-- Per-artist toggles for the system-fired notification emails that go to the
-- artist (not the client). Defaults are `true` so existing artists see no
-- change in behavior; toggling off in Settings → Reminders silences the
-- corresponding notification without affecting client-facing emails.
alter table public.artists
  add column if not exists notify_new_submission boolean not null default true,
  add column if not exists notify_new_booking    boolean not null default true,
  add column if not exists notify_reschedule     boolean not null default true,
  add column if not exists notify_contact_form   boolean not null default true;
