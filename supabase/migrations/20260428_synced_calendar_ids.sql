-- Per-artist Google Calendar selection. NULL means "not yet picked" — the app
-- falls back to ["primary"] for both freeBusy reads and event listing. Once
-- the artist saves a selection in settings (or the backfill runs), this holds
-- the explicit set of calendar IDs the artist has opted in to sync.
alter table artists
  add column if not exists synced_calendar_ids text[] default null;
