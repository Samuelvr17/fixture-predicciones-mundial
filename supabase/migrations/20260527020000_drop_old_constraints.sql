-- Migration: Drop old constraints that interfere with source_key upsert
-- Purpose: Remove constraints that depend on match_date (now Colombia date) which can change

-- Drop old constraint that depends on match_date (which is now Colombia date and can change)
-- This constraint is being replaced by source_key which is stable
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_group_unique;

-- Drop old partial index that was meant to support upsert but doesn't work with ON CONFLICT
DROP INDEX IF EXISTS idx_matches_group_slots_unique;
