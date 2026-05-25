-- Migration 015: Correct Roles and Permissions Architecture - Part 2
-- Clear separation between Global Admins and Group Leaders.

BEGIN;

-- 1. Create global_admins table
CREATE TABLE IF NOT EXISTS public.global_admins (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Migrate existing data
-- Now 'leader' is a known value and can be assigned.
UPDATE public.group_members SET role = 'leader' WHERE role = 'admin';

-- 3. Adjust Helper Functions
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

-- Global admin check
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.global_admins
    WHERE user_id = auth.uid()
  );
$$;

-- Backward compatibility alias
CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.is_group_leader(p_group_id);
$$;

-- Update is_any_group_admin to use the new role
CREATE OR REPLACE FUNCTION public.is_any_group_admin()
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
    AND (role = 'leader' OR role = 'admin')
  );
$$;

-- 4. Update RLS Policies

-- Table: groups
DROP POLICY IF EXISTS "groups_update_admin" ON public.groups;
CREATE POLICY "groups_update_leader"
  ON public.groups FOR UPDATE
  USING (public.is_group_leader(id))
  WITH CHECK (public.is_group_leader(id));

-- Table: group_members
DROP POLICY IF EXISTS "group_members_update_admin" ON public.group_members;
CREATE POLICY "group_members_update_leader"
  ON public.group_members FOR UPDATE
  USING (public.is_group_leader(group_id))
  WITH CHECK (public.is_group_leader(group_id));

DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
CREATE POLICY "group_members_delete_leader_or_self"
  ON public.group_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_group_leader(group_id)
  );

-- Table: match_results (Global Admin ONLY)
DROP POLICY IF EXISTS "match_results_insert_admin" ON public.match_results;
CREATE POLICY "match_results_insert_global_admin"
  ON public.match_results FOR INSERT
  WITH CHECK (
    public.is_global_admin()
    AND entered_by = auth.uid()
  );

DROP POLICY IF EXISTS "match_results_update_admin" ON public.match_results;
CREATE POLICY "match_results_update_global_admin"
  ON public.match_results FOR UPDATE
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

-- Table: manual_tiebreaks (Global Admin ONLY for tournament results)
DROP POLICY IF EXISTS "manual_tiebreaks_insert_admin" ON public.manual_tiebreaks;
CREATE POLICY "manual_tiebreaks_insert_global_admin"
  ON public.manual_tiebreaks FOR INSERT
  WITH CHECK (
    public.is_global_admin()
    AND resolved_by = auth.uid()
  );

DROP POLICY IF EXISTS "manual_tiebreaks_update_admin" ON public.manual_tiebreaks;
CREATE POLICY "manual_tiebreaks_update_global_admin"
  ON public.manual_tiebreaks FOR UPDATE
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

-- Table: tournament_results (Global Admin ONLY)
DROP POLICY IF EXISTS "tournament_results_insert_admin" ON public.tournament_results;
CREATE POLICY "tournament_results_insert_global_admin"
  ON public.tournament_results FOR INSERT
  WITH CHECK (public.is_global_admin());

DROP POLICY IF EXISTS "tournament_results_update_admin" ON public.tournament_results;
CREATE POLICY "tournament_results_update_global_admin"
  ON public.tournament_results FOR UPDATE
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

COMMIT;
