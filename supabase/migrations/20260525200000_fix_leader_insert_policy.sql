-- Migration: Fix group_members_insert_self policy to allow group creator to insert as leader
-- The previous policy only allowed role='member', but the creator needs to be inserted as 'leader'

BEGIN;

-- Drop the restrictive policy
DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;

-- Create a more flexible policy that:
-- 1. Allows any authenticated user to insert themselves as 'member' (joining a group)
-- 2. Allows a user to insert themselves as 'leader' ONLY if they are the creator of the group
CREATE POLICY "group_members_insert_self_or_creator_as_leader"
  ON public.group_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    and (
      -- Regular members joining a group
      role = 'member'
      or
      -- Group creator inserting themselves as leader
      (
        role = 'leader'
        and exists (
          select 1
          from public.groups
          where id = group_id
            and creator_id = auth.uid()
        )
      )
    )
  );

COMMIT;
