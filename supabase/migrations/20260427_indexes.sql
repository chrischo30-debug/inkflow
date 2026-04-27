-- Production index pass.
-- Adds the indexes that hot queries actually use; everything else is already
-- covered by primary keys, unique constraints, or existing single-column indexes.
--
-- Reviewed against:
--   - bookings_artist_id_idx, bookings_state_idx, bookings_created_at_idx (phase1)
--   - bookings_google_event_id_idx (google_calendar_sync)
--   - email_templates unique (artist_id, state) (existing)
--   - custom_form_fields_artist_id_idx (existing)
--   - contact_submissions_artist_id_idx (existing)
--   - webhook_sources.token UNIQUE (existing — covers token lookup)

-- form_fields: queried as `WHERE artist_id = ?` from the bookings page and the
-- public booking page; no index today (FK alone doesn't cover filter scans).
CREATE INDEX IF NOT EXISTS form_fields_artist_id_idx
  ON form_fields(artist_id);

-- webhook_sources: token has a unique index (good); the per-artist list view
-- in /api/artist/webhook-sources scans by artist_id.
CREATE INDEX IF NOT EXISTS webhook_sources_artist_id_idx
  ON webhook_sources(artist_id);

-- bookings list ordering. The dashboard and pipeline both order by sort_order
-- within an artist. A composite avoids a sort step on top of the artist filter.
CREATE INDEX IF NOT EXISTS bookings_artist_sort_idx
  ON bookings(artist_id, sort_order);

-- bookings by appointment date, per artist. Used by:
--   - the reminders cron: WHERE artist_id = ? AND appointment_date BETWEEN ...
--   - the calendar view
-- bookings_artist_id_idx alone would scan all of an artist's rows.
CREATE INDEX IF NOT EXISTS bookings_artist_appointment_idx
  ON bookings(artist_id, appointment_date)
  WHERE appointment_date IS NOT NULL;
