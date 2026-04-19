-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Define Booking State Enum to enforce strict pipeline workflow
create type public.booking_state as enum (
  'inquiry',
  'reviewed',
  'deposit_sent',
  'deposit_paid',
  'confirmed',
  'completed'
);

-- ==========================================
-- 1. Artists Table
-- ==========================================
create table public.artists (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique not null,
  full_name text not null,
  payment_link text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Public readability for booking forms, owner-only updates
alter table public.artists enable row level security;

create policy "Artists are publicly viewable."
  on public.artists for select
  using (true);

create policy "Artists can update own profile."
  on public.artists for update
  using (auth.uid() = id);

-- ==========================================
-- 2. Bookings Table
-- ==========================================
create table public.bookings (
  id uuid default uuid_generate_v4() primary key,
  artist_id uuid references public.artists(id) on delete cascade not null,
  client_name text not null,
  client_email text not null,
  client_phone text,
  description text not null,
  ideal_date text,
  state public.booking_state default 'inquiry'::public.booking_state not null,
  appointment_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Public insert (anyone can book), owner-only select/update
alter table public.bookings enable row level security;

create policy "Anyone can submit a booking."
  on public.bookings for insert
  with check (true);

create policy "Artists can view their own bookings."
  on public.bookings for select
  using (auth.uid() = artist_id);

create policy "Artists can update their own bookings."
  on public.bookings for update
  using (auth.uid() = artist_id);

-- ==========================================
-- Triggers
-- ==========================================
-- Function to automatically update timestamps
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_booking_updated
  before update on public.bookings
  for each row execute procedure public.handle_updated_at();
