-- Allow custom (non-state-linked) email templates
alter table email_templates
  add column if not exists name text;

-- Make state nullable so custom templates don't need a state
alter table email_templates
  alter column state drop not null;

-- Drop the old unique constraint and replace with a partial one
-- (state-linked templates still unique per state, custom templates unrestricted)
alter table email_templates
  drop constraint if exists email_templates_artist_id_state_key;

create unique index if not exists email_templates_artist_state_unique
  on email_templates (artist_id, state)
  where state is not null;
