alter table bookings
  add column if not exists session_count integer not null default 1,
  add column if not exists session_durations integer[] default null;
