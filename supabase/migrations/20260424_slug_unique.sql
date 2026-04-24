-- Defensive: ensure artist slugs are globally unique, case-insensitive.
-- The original schema had `slug text not null unique`, but case variations
-- (Chris vs chris) would still slip through a plain unique constraint on
-- an arbitrary-case text column. This replaces/supplements it with a
-- lower(slug) unique index.

-- Step 1: Find and surface duplicates so they can be resolved manually
-- before the unique index can be created. Run this as a SELECT first:
--
--   SELECT lower(slug) AS slug_lc, count(*) AS dup_count, array_agg(id) AS artist_ids
--     FROM artists
--    WHERE slug IS NOT NULL
--    GROUP BY lower(slug)
--   HAVING count(*) > 1;
--
-- Manually update one of each pair to a different slug before running
-- the next step, otherwise index creation will fail.

-- Step 2: Create the case-insensitive unique index.
create unique index if not exists artists_slug_lower_unique
  on public.artists (lower(slug))
  where slug is not null;
