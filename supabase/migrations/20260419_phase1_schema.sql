-- ============================================================
-- InkFlow Phase 1 Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ARTISTS
-- One row per artist (linked to Supabase Auth user)
-- ============================================================
create table if not exists artists (
  id                   uuid primary key references auth.users(id) on delete cascade,
  name                 text not null,
  email                text not null unique,
  slug                 text not null unique,         -- used in public booking URL /book/[slug]
  studio_name          text,
  style_tags           text[]          default '{}',
  deposit_amount       numeric(10,2),
  payment_links        jsonb           default '{}', -- { "Stripe": "...", "Venmo": "..." }
  calendar_sync_enabled boolean        default false,
  google_refresh_token text,                         -- stored encrypted in service only
  auto_process_inquiries boolean       default false, -- skip manual review step
  created_at           timestamptz     default now(),
  updated_at           timestamptz     default now()
);

-- ============================================================
-- BOOKINGS
-- Each row is one client inquiry / booking
-- ============================================================
create type booking_state as enum (
  'inquiry',
  'reviewed',
  'deposit_sent',
  'deposit_paid',
  'confirmed',
  'completed',
  'cancelled'
);

create table if not exists bookings (
  id                uuid            primary key default uuid_generate_v4(),
  artist_id         uuid            not null references artists(id) on delete cascade,
  -- Client info
  client_name       text            not null,
  client_email      text            not null,
  client_phone      text,
  -- Tattoo details
  description       text            not null,
  size              text,           -- e.g. "palm-sized", "half sleeve"
  placement         text,           -- e.g. "upper arm"
  budget            numeric(10,2),
  reference_urls    text[]          default '{}',
  -- Pipeline
  state             booking_state   not null default 'inquiry',
  -- Payment
  payment_link_sent text,           -- the specific link sent to this client
  deposit_amount    numeric(10,2),
  -- Appointment
  appointment_date  timestamptz,
  -- Email tracking
  last_email_sent_at timestamptz,
  -- Timestamps
  created_at        timestamptz     default now(),
  updated_at        timestamptz     default now()
);

-- ============================================================
-- EMAIL TEMPLATES
-- Per-artist templates for each pipeline state transition
-- ============================================================
create table if not exists email_templates (
  id          uuid        primary key default uuid_generate_v4(),
  artist_id   uuid        not null references artists(id) on delete cascade,
  state       booking_state not null,       -- the state this email fires on
  subject     text        not null,
  body        text        not null,         -- plain text or simple HTML
  auto_send   boolean     default false,    -- send automatically on state change
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(artist_id, state)
);

-- ============================================================
-- FORM FIELDS
-- Per-artist config for which booking form fields are shown
-- ============================================================
create table if not exists form_fields (
  id          uuid        primary key default uuid_generate_v4(),
  artist_id   uuid        not null references artists(id) on delete cascade,
  field_key   text        not null,   -- e.g. "phone", "budget", "reference_images"
  enabled     boolean     default true,
  required    boolean     default false,
  sort_order  int         default 0,
  unique(artist_id, field_key)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists bookings_artist_id_idx on bookings(artist_id);
create index if not exists bookings_state_idx on bookings(state);
create index if not exists bookings_created_at_idx on bookings(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- Artists can only see and edit their own data
-- ============================================================
alter table artists        enable row level security;
alter table bookings       enable row level security;
alter table email_templates enable row level security;
alter table form_fields    enable row level security;

-- Artists: can only read/update their own row
create policy "artists: own row only"
  on artists for all
  using (id = auth.uid());

-- Bookings: artist sees only their own bookings
create policy "bookings: artist owns"
  on bookings for all
  using (artist_id = auth.uid());

-- Email templates: artist owns
create policy "email_templates: artist owns"
  on email_templates for all
  using (artist_id = auth.uid());

-- Form fields: artist owns
create policy "form_fields: artist owns"
  on form_fields for all
  using (artist_id = auth.uid());

-- ============================================================
-- AUTO-UPDATE updated_at ON CHANGES
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger artists_updated_at
  before update on artists
  for each row execute function update_updated_at();

create trigger bookings_updated_at
  before update on bookings
  for each row execute function update_updated_at();

create trigger email_templates_updated_at
  before update on email_templates
  for each row execute function update_updated_at();

create trigger form_fields_updated_at
  before update on form_fields
  for each row execute function update_updated_at();
