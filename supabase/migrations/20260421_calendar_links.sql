-- Replace single calendar_link with array of labeled links
alter table artists
  add column if not exists calendar_links jsonb not null default '[]';

-- Migrate any existing single link into the array
update artists
  set calendar_links = jsonb_build_array(jsonb_build_object('label', 'Book a session', 'url', calendar_link))
  where calendar_link is not null and calendar_link <> '';

alter table artists drop column if exists calendar_link;
