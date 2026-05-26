-- Migration: Definitive cleanup of group roles - remove 'admin' from enum and legacy functions
-- This migration performs definitive cleanup after verifying no dependencies exist
-- Verified: no group_members with role='admin', no dependencies on is_group_admin/is_any_group_admin

BEGIN;

-- 1. Convert any remaining 'admin' roles to 'leader' (safety check)
UPDATE public.group_members 
SET role = 'leader' 
WHERE role = 'admin';

-- 2. Drop legacy functions if they exist
DROP FUNCTION IF EXISTS public.is_group_admin(p_group_id uuid);
DROP FUNCTION IF EXISTS public.is_any_group_admin();

-- 3. Create or replace is_group_leader function
CREATE OR REPLACE FUNCTION public.is_group_leader(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
      AND role     = 'leader'
  );
$$;

-- 4. Create or replace is_any_group_leader function
CREATE OR REPLACE FUNCTION public.is_any_group_leader()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = auth.uid()
      AND role = 'leader'
  );
$$;

-- 5. Remove 'admin' from group_role enum safely
-- Step 5a: Drop policy that depends on role column (required before altering type)
DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;

-- Step 5b: Save and drop the default on group_members.role
ALTER TABLE public.group_members ALTER COLUMN role DROP DEFAULT;

-- Step 5c: Rename old enum
ALTER TYPE public.group_role RENAME TO group_role_old;

-- Step 5d: Create new enum without 'admin'
CREATE TYPE public.group_role AS ENUM ('member', 'leader');

-- Step 5e: Alter column to use new enum
ALTER TABLE public.group_members 
ALTER COLUMN role TYPE public.group_role 
USING role::text::public.group_role;

-- Step 5f: Restore default
ALTER TABLE public.group_members ALTER COLUMN role SET DEFAULT 'member'::public.group_role;

-- Step 5g: Drop old enum
DROP TYPE public.group_role_old;

-- Step 5h: Recreate the policy that was dropped
CREATE POLICY "group_members_insert_self"
  ON public.group_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    and role = 'member'
  );

-- 6. Recreate RLS policies for group management using is_group_leader
-- (These ensure consistency even if already updated in part2)

-- Table: groups - leader can update group config
DROP POLICY IF EXISTS "groups_update_leader" ON public.groups;
CREATE POLICY "groups_update_leader"
  ON public.groups FOR UPDATE
  USING (public.is_group_leader(id))
  WITH CHECK (public.is_group_leader(id));

-- Table: group_members - leader can update member roles
DROP POLICY IF EXISTS "group_members_update_leader" ON public.group_members;
CREATE POLICY "group_members_update_leader"
  ON public.group_members FOR UPDATE
  USING (public.is_group_leader(group_id))
  WITH CHECK (public.is_group_leader(group_id));

-- Table: group_members - leader can delete members
DROP POLICY IF EXISTS "group_members_delete_leader_or_self" ON public.group_members;
CREATE POLICY "group_members_delete_leader_or_self"
  ON public.group_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_group_leader(group_id)
  );

-- Note: match_results, manual_tiebreaks, and tournament_results policies
-- already use is_global_admin (updated in part2), so we don't modify them here
-- Note: global_admins table and is_global_admin function are not touched

COMMIT;
