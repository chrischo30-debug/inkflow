-- Per-template kill switch. When false, the template never auto-sends and the
-- compose modal never pops on the matching state transition — the artist just
-- moves the booking forward silently with no client email at all.
alter table email_templates
  add column if not exists enabled boolean not null default true;
