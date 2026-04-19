-- ============================================================
-- Default/base form field display config
-- ============================================================

alter table public.form_fields
  add column if not exists label text,
  add column if not exists placeholder text;

