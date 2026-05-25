-- Migration 014: Correct Roles and Permissions Architecture - Part 1
-- Add 'leader' value to group_role enum.
-- This must be in its own migration to be usable in subsequent statements in some environments.

ALTER TYPE public.group_role ADD VALUE IF NOT EXISTS 'leader';
