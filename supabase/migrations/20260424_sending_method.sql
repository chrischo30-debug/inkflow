-- Sending method pivot: artists choose between flashbooker-subdomain, custom domain, or gmail-smtp
alter table artists
  add column if not exists sending_method text not null default 'flashbooker'
    check (sending_method in ('flashbooker','custom_domain','gmail_smtp')),
  add column if not exists sending_local_part text,
  add column if not exists sending_display_name text,
  add column if not exists custom_sending_domain text,
  add column if not exists custom_sending_domain_verified boolean not null default false,
  add column if not exists resend_domain_id text,
  add column if not exists gmail_smtp_email text,
  add column if not exists gmail_smtp_password_encrypted text;

-- Backfill defaults for existing rows
update artists
   set sending_local_part = lower(regexp_replace(slug, '[^a-zA-Z0-9._-]', '', 'g'))
 where sending_local_part is null
   and slug is not null;

update artists
   set sending_display_name = coalesce(name, studio_name, 'Your Artist')
 where sending_display_name is null;

-- inbox_messages table: unified storage for inbound replies parsed by the webhook
create table if not exists public.inbox_messages (
  id             uuid primary key default gen_random_uuid(),
  artist_id     uuid references public.artists(id) on delete cascade,
  booking_id    uuid references public.bookings(id) on delete set null,
  from_email    text not null,
  from_name     text,
  to_email      text,
  subject       text,
  body_text     text,
  body_html     text,
  provider_id   text,
  received_at   timestamptz not null default now(),
  read_at       timestamptz
);

create index if not exists inbox_messages_artist_idx   on public.inbox_messages(artist_id, received_at desc);
create index if not exists inbox_messages_booking_idx  on public.inbox_messages(booking_id, received_at desc);
