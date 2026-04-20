alter table artists
  add column if not exists form_header text,
  add column if not exists form_subtext text,
  add column if not exists form_button_text text;
