alter table artists
  add column if not exists accent_theme text default 'crimson';
