-- Migration: RPC function for joining groups by invite code
-- This function allows users to join groups by invite code without needing SELECT access to groups table

BEGIN;

-- Create RPC function to join group by invite code
CREATE OR REPLACE FUNCTION public.join_group_by_code(p_invite_code text)
RETURNS TABLE(group_id uuid, group_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group_id uuid;
  v_group_name text;
  v_normalized_code text;
BEGIN
  -- Reject unauthenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Normalize the invite code
  v_normalized_code := upper(trim(p_invite_code));

  -- Find the group by invite code
  SELECT id, name INTO v_group_id, v_group_name
  FROM public.groups
  WHERE invite_code = v_normalized_code
    AND is_active = true
  LIMIT 1;

  -- Validate group exists
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = v_group_id
      AND user_id = auth.uid()
  ) THEN
    -- Already a member, just return the group info
    RETURN QUERY SELECT v_group_id, v_group_name;
    RETURN;
  END IF;

  -- Add user as member
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, auth.uid(), 'member');

  -- Return the group info
  RETURN QUERY SELECT v_group_id, v_group_name;
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;

COMMIT;
