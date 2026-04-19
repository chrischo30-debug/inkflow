-- ============================================================
-- Allow custom form fields to support file upload or links
-- ============================================================

alter table public.custom_form_fields
  drop constraint if exists custom_form_fields_type_check;

alter table public.custom_form_fields
  add constraint custom_form_fields_type_check
  check (type in ('text', 'textarea', 'number', 'select', 'checkbox', 'date', 'url', 'file_or_link'));
