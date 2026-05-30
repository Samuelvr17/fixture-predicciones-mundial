/**
 * src/server/actions/saveManualTiebreak.ts
 *
 * Server action for saving official manual tiebreaks and recalculating scores.
 * This action is protected to ensure only global admins can resolve official ties.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { triggerRecalculateAllScores } from './recalculateScores';
import type { Database } from '@/types/database.types';

type ManualTiebreakType = Database['public']['Enums']['tiebreak_type'];

interface SaveManualTiebreakParams {
  type: ManualTiebreakType;
  reference: string;
  orderedTeamIds: string[];
}

interface SaveManualTiebreakResult {
  success: boolean;
  error?: string;
  recalculationError?: string;
}

const GROUP_REFERENCE_PATTERN = /^[A-L]$/;

function validateTiebreakParams(params: SaveManualTiebreakParams): string | null {
  if (params.type === 'group_tiebreak') {
    if (!GROUP_REFERENCE_PATTERN.test(params.reference)) {
      return 'El grupo del desempate no es válido';
    }
  } else if (params.type === 'best_thirds') {
    if (params.reference !== 'best_thirds') {
      return 'La referencia de mejores terceros no es válida';
    }
  } else {
    return 'El tipo de desempate no es válido';
  }

  if (params.orderedTeamIds.length < 2) {
    return 'Debe ordenar al menos dos equipos para resolver un desempate';
  }

  const uniqueTeamIds = new Set(params.orderedTeamIds);
  if (uniqueTeamIds.size !== params.orderedTeamIds.length) {
    return 'La resolución no puede contener equipos duplicados';
  }

  if (params.orderedTeamIds.some((teamId) => !teamId)) {
    return 'La resolución contiene equipos inválidos';
  }

  return null;
}

/**
 * Saves or updates an official manual tiebreak, then recalculates every score.
 * Returns success even if score recalculation fails because the tiebreak itself
 * has already been persisted.
 */
export async function saveManualTiebreak(
  params: SaveManualTiebreakParams
): Promise<SaveManualTiebreakResult> {
  const validationError = validateTiebreakParams(params);
  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  const supabase = await createClient();

  // Verify user is authenticated.
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      success: false,
      error: 'User not authenticated',
    };
  }

  // Verify user is global admin.
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
    const { error: upsertError } = await supabase
      .from('manual_tiebreaks')
      .upsert(
        {
          type: params.type,
          reference: params.reference,
          ordered_team_ids: params.orderedTeamIds,
          resolved_by: user.id,
        },
        { onConflict: 'type,reference' }
      );

    if (upsertError) {
      return {
        success: false,
        error: upsertError.message,
      };
    }

    const recalcResult = await triggerRecalculateAllScores();

    revalidatePath('/standings');
    revalidatePath('/global-admin/tiebreaks');
    revalidatePath('/groups/[groupId]/leaderboard', 'page');
    revalidatePath('/groups/[groupId]/bracket', 'page');

    if (!recalcResult.success) {
      console.error('Score recalculation failed after saving manual tiebreak:', recalcResult.error);
      return {
        success: true,
        recalculationError: recalcResult.error || 'Error al recalcular puntajes',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error saving manual tiebreak:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
