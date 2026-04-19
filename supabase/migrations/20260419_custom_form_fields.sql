-- ============================================================
-- Custom form fields + booking custom answers
-- ============================================================

alter table public.bookings
  add column if not exists custom_answers jsonb default '{}';

create table if not exists public.custom_form_fields (
  id uuid primary key default uuid_generate_v4(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  field_key text not null,
  label text not null,
  type text not null check (type in ('text', 'textarea', 'number', 'select', 'checkbox', 'date', 'url')),
  enabled boolean default true,
  required boolean default false,
  sort_order int default 0,
  placeholder text,
  options jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (artist_id, field_key)
);

create index if not exists custom_form_fields_artist_id_idx on public.custom_form_fields(artist_id);

alter table public.custom_form_fields enable row level security;

create policy "custom_form_fields: artist owns"
  on public.custom_form_fields for all
  using (artist_id = auth.uid());

drop trigger if exists custom_form_fields_updated_at on public.custom_form_fields;
create trigger custom_form_fields_updated_at
  before update on public.custom_form_fields
  for each row execute function update_updated_at();

