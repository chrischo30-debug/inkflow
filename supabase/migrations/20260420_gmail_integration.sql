-- Gmail integration fields on artists
alter table artists
  add column if not exists gmail_connected boolean default false,
  add column if not exists gmail_address   text;

-- Thread ID on bookings for Gmail conversation linking
alter table bookings
  add column if not exists gmail_thread_id text;
