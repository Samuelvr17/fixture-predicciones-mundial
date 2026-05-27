-- Migration: Fix groups_insert_authenticated policy for table groups
-- This ensures that authenticated users can create groups with themselves as creator

BEGIN;

-- Drop the policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "groups_insert_authenticated" ON public.groups;

-- Create the policy that allows authenticated users to insert groups
-- The user must be authenticated (auth.uid() is not null)
-- The creator_id must match the authenticated user's ID
CREATE POLICY "groups_insert_authenticated"
  ON public.groups FOR INSERT
  WITH CHECK (
    auth.uid() is not null 
    AND creator_id = auth.uid()
  );

COMMIT;
