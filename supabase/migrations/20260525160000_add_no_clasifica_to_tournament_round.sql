-- Migration: Add 'no_clasifica' to tournament_round enum
-- This allows users to predict that a team won't qualify for knockout stage

-- First, we need to add the new value to the enum
-- In PostgreSQL, we can't directly add to an enum if it's in use
-- We need to: 1. Add new value, 2. Alter type

ALTER TYPE public.tournament_round ADD VALUE 'no_clasifica';
