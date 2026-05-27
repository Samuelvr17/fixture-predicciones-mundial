-- Migration: Comprehensive fix for groups table RLS
-- This ensures RLS is properly configured for the groups table

BEGIN;

-- 1. Ensure RLS is enabled on groups table
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- 2. Remove ALL existing policies on groups to start fresh
DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_authenticated" ON public.groups;
DROP POLICY IF EXISTS "groups_update_leader" ON public.groups;
DROP POLICY IF EXISTS "groups_update_admin" ON public.groups;

-- 3. Create SELECT policy - members can see groups they belong to
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

-- 4. Create INSERT policy - authenticated users can create groups
CREATE POLICY "groups_insert_authenticated"
  ON public.groups FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND creator_id = auth.uid()
  );

-- 5. Create UPDATE policy - only group leaders can update group config
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'leader'
    )
  );

COMMIT;
