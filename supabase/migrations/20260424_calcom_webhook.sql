alter table artists
  add column if not exists calcom_webhook_secret text;

alter table bookings
  add column if not exists calcom_booking_uid text;

create index if not exists bookings_calcom_uid_idx on public.bookings(calcom_booking_uid);
