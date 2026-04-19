-- ============================================================
-- Google Calendar sync support
-- ============================================================

alter table public.bookings
  add column if not exists google_event_id text;

create index if not exists bookings_google_event_id_idx on public.bookings(google_event_id);
