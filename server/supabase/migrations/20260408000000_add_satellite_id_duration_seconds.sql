-- Migration: add_satellite_id_duration_seconds
-- Adds two columns required by the SENTRY feature spec to journal_entries.
--
-- satellite_id  TEXT     — the NORAD catalog ID (as text) of the observed satellite.
--                          Nullable so existing rows are not broken; no FK because the
--                          satellites table lives outside Supabase (TLE service).
-- duration_seconds INT  — how long (in whole seconds) the sighting lasted.
--                          Nullable; observers don't always time their sightings.
--
-- Column-name audit vs spec checklist (no renames made — see TODOs below):
--   pass_timestamp  — spec says "observed_at". Keeping current name: it is more
--                     specific (the predicted pass time) and is used across all
--                     TypeScript types, routes, and DB queries.
--                     TODO: confirm whether to rename to observed_at with spec owner.
--   star_rating     — spec says "visibility_rating". Keeping current name: star_rating
--                     describes the UI widget (1-5 stars) while visibility_rating would
--                     imply atmospheric conditions only.
--                     TODO: confirm naming with spec owner.
--   city + region   — spec lists a single "location_label". Keeping separate columns:
--                     they are better normalised and power the Near You feed filter.
--                     TODO: decide whether to add a generated location_label column.
--
-- Down migration (run manually if needed):
--   ALTER TABLE journal_entries DROP COLUMN IF EXISTS satellite_id;
--   ALTER TABLE journal_entries DROP COLUMN IF EXISTS duration_seconds;
--   DROP INDEX IF EXISTS idx_journal_entries_satellite_id;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS satellite_id TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Sparse index: only index rows that actually have a satellite_id recorded.
-- Supports future queries like "all sightings of NORAD 25544".
CREATE INDEX IF NOT EXISTS idx_journal_entries_satellite_id
  ON journal_entries (satellite_id)
  WHERE satellite_id IS NOT NULL;
