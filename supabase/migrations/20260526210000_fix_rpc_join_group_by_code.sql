-- Migration: Fix RPC function join_group_by_code to avoid column reference ambiguity
-- Issue: RETURNS TABLE(group_id uuid, group_name text) creates internal variables
-- that conflict with unqualified column references. Fixed by using table aliases.

BEGIN;

-- Create or replace RPC function with proper aliases to avoid ambiguity
CREATE OR REPLACE FUNCTION public.join_group_by_code(p_invite_code text)
RETURNS TABLE(group_id uuid, group_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_group_id uuid;
  v_group_name text;
  v_code text;
BEGIN
  -- Get authenticated user ID
  v_user_id := auth.uid();
  
  -- Reject unauthenticated users
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Normalize the invite code
  v_code := upper(trim(p_invite_code));

  -- Find the group by invite code using alias
  SELECT g.id, g.name
  INTO v_group_id, v_group_name
  FROM public.groups g
  WHERE upper(trim(g.invite_code)) = v_code
    AND g.is_active = true
  LIMIT 1;

  -- Validate group exists
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;

  -- Check if user is already a member using alias
  IF EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = v_group_id
      AND gm.user_id = v_user_id
  ) THEN
    -- Already a member, just return the group info
    RETURN QUERY SELECT v_group_id AS group_id, v_group_name AS group_name;
    RETURN;
  END IF;

  -- Add user as member
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'member');

  -- Return the group info with explicit column aliases
  RETURN QUERY SELECT v_group_id AS group_id, v_group_name AS group_name;
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;

COMMIT;
