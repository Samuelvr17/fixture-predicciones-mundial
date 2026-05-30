/**
 * src/server/actions/recalculateScores.ts
 *
 * Server actions for triggering score recalculation.
 * These actions can be called from client components and are protected
 * to ensure only global admins can trigger them.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { recalculateAllGroupScores, recalculateGroupScores } from '@/server/scoring/recalculateScores';
import { revalidatePath } from 'next/cache';

/**
 * Server action to recalculate scores for all groups.
 * Only accessible to global admins.
 * 
 * This action:
 * 1. Verifies the user is a global admin
 * 2. Triggers recalculation for all active groups
 * 3. Revalidates the leaderboard cache
 * 
 * @returns Success status and results
 */
export async function triggerRecalculateAllScores() {
  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      success: false,
      error: 'User not authenticated',
    };
  }

  // Verify user is global admin
  const { data: globalAdminCheck, error: adminError } = await supabase
    .from('global_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !globalAdminCheck) {
    return {
      success: false,
      error: 'User is not a global admin',
    };
  }

  try {
    // Recalculate all group scores
    const results = await recalculateAllGroupScores();

    // Revalidate relevant routes
    revalidatePath('/standings');
    revalidatePath('/groups/[groupId]/leaderboard', 'page');
    revalidatePath('/groups/[groupId]/bracket', 'page');

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error('Error triggering score recalculation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Server action to recalculate scores for a specific group.
 * Only accessible to global admins.
 * 
 * This action:
 * 1. Verifies the user is a global admin
 * 2. Triggers recalculation for the specified group
 * 3. Revalidates the leaderboard cache for that group
 * 
 * @param groupId - The ID of the group to recalculate
 * @returns Success status and results
 */
export async function triggerRecalculateGroupScores(groupId: string) {
  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      success: false,
      error: 'User not authenticated',
    };
  }

  // Verify user is global admin
  const { data: globalAdminCheck, error: adminError } = await supabase
    .from('global_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !globalAdminCheck) {
    return {
      success: false,
      error: 'User is not a global admin',
    };
  }

  try {
    // Recalculate group scores
    const result = await recalculateGroupScores(groupId);

    // Revalidate leaderboard paths
    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/${groupId}`);

    return {
      success: result.success,
      result,
    };
  } catch (error) {
    console.error(`Error triggering score recalculation for group ${groupId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
