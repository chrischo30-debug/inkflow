alter table artists
  add column if not exists pipeline_settings jsonb not null default '{}',
  add column if not exists calendar_link text;
