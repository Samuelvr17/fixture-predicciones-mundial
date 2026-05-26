-- Migration: Add details column to score_breakdowns
-- This column stores the detailed breakdown of points per match/team for debugging and display

alter table public.score_breakdowns
add column details jsonb default '{}'::jsonb;

-- Add comment for documentation
comment on column public.score_breakdowns.details is 'Detailed breakdown of points per match/team (groupStageExact, groupStageOutcome, knockoutExact, advancement)';
