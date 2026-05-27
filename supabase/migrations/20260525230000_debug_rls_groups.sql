-- Migration: Debug and fix RLS for groups table
-- First, let's check current state and then fix it

BEGIN;

-- 1. Disable RLS temporarily to allow inserts
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;

-- 2. Re-enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- 3. Drop all existing policies
DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_authenticated" ON public.groups;
DROP POLICY IF EXISTS "groups_update_leader" ON public.groups;
DROP POLICY IF EXISTS "groups_update_admin" ON public.groups;

-- 4. Create INSERT policy - very permissive for debugging
CREATE POLICY "groups_insert_authenticated"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Create SELECT policy
CREATE POLICY "groups_select_member"
  ON public.groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = auth.uid()
    )
  );

-- 6. Create UPDATE policy
CREATE POLICY "groups_update_leader"
  ON public.groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'leader'
    )
  );

COMMIT;
