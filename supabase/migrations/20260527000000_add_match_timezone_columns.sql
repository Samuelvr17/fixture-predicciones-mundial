-- Migration: Add timezone columns to matches table
-- Purpose: Store UTC kickoff time, venue timezone, and venue local time for proper timezone handling

-- Add new columns to matches table
ALTER TABLE public.matches
  ADD COLUMN kickoff_at_utc timestamptz,
  ADD COLUMN venue_timezone text,
  ADD COLUMN venue_local_time text;

-- Add comments for documentation
COMMENT ON COLUMN public.matches.kickoff_at_utc IS 'UTC timestamp of match kickoff (universal time)';
COMMENT ON COLUMN public.matches.venue_timezone IS 'Original timezone offset of the venue (e.g., "UTC-6")';
COMMENT ON COLUMN public.matches.venue_local_time IS 'Local time at the venue (e.g., "13:00:00")';

-- Add partial unique index for group matches (team1_slot, team2_slot) to support upsert without match_date
-- This is needed because match_date will change from venue date to Colombia date
-- PostgreSQL doesn't support UNIQUE constraint with WHERE clause, so we use a partial unique index instead
CREATE UNIQUE INDEX idx_matches_group_slots_unique ON public.matches (team1_slot, team2_slot) WHERE match_number IS NULL;
