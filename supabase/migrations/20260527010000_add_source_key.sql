-- Migration: Add source_key to matches table
-- Purpose: Add a stable unique key for upsert operations that doesn't depend on match_date or match_time

-- Drop old constraint that depends on match_date (which is now Colombia date and can change)
-- This constraint is being replaced by source_key which is stable
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_group_unique;

-- Drop old partial index that was meant to support upsert but doesn't work with ON CONFLICT
DROP INDEX IF EXISTS idx_matches_group_slots_unique;

-- Add source_key column (nullable initially for backfill)
ALTER TABLE public.matches
  ADD COLUMN source_key text;

-- Backfill source_key for existing rows
-- For matches with match_number: 'match-{match_number}'
-- For group matches without match_number: 'group-{group_code}-{team1_slot}-{team2_slot}'
UPDATE public.matches
SET source_key = CASE
  WHEN match_number IS NOT NULL THEN 'match-' || match_number::text
  ELSE 'group-' || COALESCE(group_code, '') || '-' || lower(regexp_replace(team1_slot, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || lower(regexp_replace(team2_slot, '[^a-zA-Z0-9]+', '-', 'g'))
END
WHERE source_key IS NULL;

-- Verify no nulls before making NOT NULL
-- If this fails, there are rows that couldn't be backfilled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.matches WHERE source_key IS NULL) THEN
    RAISE EXCEPTION 'Found rows with null source_key after backfill';
  END IF;
END $$;

-- Make source_key NOT NULL after backfill
ALTER TABLE public.matches
  ALTER COLUMN source_key SET NOT NULL;

-- Add unique constraint on source_key
ALTER TABLE public.matches
  ADD CONSTRAINT matches_source_key_unique UNIQUE (source_key);

-- Add comment
COMMENT ON COLUMN public.matches.source_key IS 'Stable unique key for upsert operations. Format: match-{match_number} for knockout matches, group-{group_code}-{team1_slot}-{team2_slot} for group matches';
