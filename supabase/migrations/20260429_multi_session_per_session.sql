-- Per-session tracking for multi-session bookings.
-- session_appointments holds per-session metadata (date, completion timestamp,
-- per-session payout, google_event_id, etc) indexed by session index 0..N-1.
-- completed_session_count is the count of sessions the artist has marked done;
-- when it reaches session_count, the booking can move to `completed`.
alter table public.bookings
  add column if not exists session_appointments jsonb not null default '[]'::jsonb,
  add column if not exists completed_session_count integer not null default 0;
