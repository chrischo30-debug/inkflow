-- ============================================================
-- Extend form_fields input_type options
-- ============================================================

alter table public.form_fields
  drop constraint if exists form_fields_input_type_check;

alter table public.form_fields
  add constraint form_fields_input_type_check
  check (input_type in ('text', 'textarea', 'number', 'select', 'checkbox', 'date', 'url', 'file_or_link'));
