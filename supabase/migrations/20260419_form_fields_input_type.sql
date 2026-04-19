-- ============================================================
-- Base/default field input type config
-- ============================================================

alter table public.form_fields
  add column if not exists input_type text check (input_type in ('text', 'textarea', 'number', 'select')),
  add column if not exists options jsonb default '[]';

