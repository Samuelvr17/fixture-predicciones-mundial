/**
 * src/server/actions/saveMatchResult.ts
 *
 * Server action for saving match results and triggering score recalculation.
 * This action is protected to ensure only global admins can save results.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { triggerRecalculateAllScores } from './recalculateScores';
import { revalidatePath } from 'next/cache';

interface SaveMatchResultParams {
  matchId: string;
  team1Score: number;
  team2Score: number;
  winnerTeamId: string | null;
}

interface SaveMatchResultResult {
  success: boolean;
  error?: string;
  recalculationError?: string;
}

/**
 * Server action to save a match result and trigger score recalculation.
 * Only accessible to global admins.
 * 
 * This action:
 * 1. Verifies the user is a global admin
 * 2. Saves or updates the match result
 * 3. Triggers score recalculation for all groups
 * 4. Revalidates relevant routes
 * 5. Returns success even if recalculation fails (result is still saved)
 * 
 * @param params - Match result parameters
 * @returns Success status and any errors
 */
export async function saveMatchResult(params: SaveMatchResultParams): Promise<SaveMatchResultResult> {
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
    // Validations
    if (params.team1Score < 0 || params.team2Score < 0) {
      return {
        success: false,
        error: 'Los goles deben ser números enteros mayores o iguales a 0',
      };
    }

    if (!Number.isInteger(params.team1Score) || !Number.isInteger(params.team2Score)) {
      return {
        success: false,
        error: 'Los goles deben ser números enteros',
      };
    }

    // Fetch match to determine round type
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('round, team1_id, team2_id')
      .eq('id', params.matchId)
      .single();

    if (matchError || !match) {
      return {
        success: false,
        error: 'No se pudo encontrar el partido',
      };
    }

    const isGroupStage = match.round === 'group';
    const isKnockoutStage = !isGroupStage;

    // If winner is provided, it must be one of the teams
    if (params.winnerTeamId) {
      if (params.winnerTeamId !== match.team1_id && params.winnerTeamId !== match.team2_id) {
        return {
          success: false,
          error: 'El equipo ganador debe ser uno de los dos equipos del partido',
        };
      }
    }

    // Knockout stage validations
    if (isKnockoutStage) {
      const isDraw = params.team1Score === params.team2Score;

      if (isDraw) {
        // In knockout stage, if it's a draw, winnerTeamId is REQUIRED
        if (!params.winnerTeamId) {
          return {
            success: false,
            error: 'En eliminatorias con empate, debe seleccionar manualmente el equipo clasificado',
          };
        }
      } else {
        // If not a draw, winnerTeamId should match the team with higher score
        const expectedWinnerId = params.team1Score > params.team2Score ? match.team1_id : match.team2_id;
        
        if (params.winnerTeamId && params.winnerTeamId !== expectedWinnerId) {
          return {
            success: false,
            error: 'El equipo ganador no coincide con el marcador del partido',
          };
        }
      }
    } else {
      // Group stage: winnerTeamId can only be null if it's a draw
      const isDraw = params.team1Score === params.team2Score;
      
      if (!isDraw && !params.winnerTeamId) {
        // In group stage without draw, winnerTeamId should be inferred
        // But we allow it to be null for flexibility, the scoring system will handle it
      }
      
      if (isDraw && params.winnerTeamId) {
        return {
          success: false,
          error: 'En fase de grupos con empate, no debe haber un equipo ganador',
        };
      }
    }

    // Check if result already exists
    const { data: existingResult } = await supabase
      .from('match_results')
      .select('id')
      .eq('match_id', params.matchId)
      .single();

    if (existingResult) {
      // Update existing result
      const { error: updateError } = await supabase
        .from('match_results')
        .update({
          team1_score: params.team1Score,
          team2_score: params.team2Score,
          winner_team_id: params.winnerTeamId,
        })
        .eq('id', existingResult.id);

      if (updateError) {
        return {
          success: false,
          error: updateError.message,
        };
      }
    } else {
      // Insert new result
      const { error: insertError } = await supabase
        .from('match_results')
        .insert({
          match_id: params.matchId,
          team1_score: params.team1Score,
          team2_score: params.team2Score,
          winner_team_id: params.winnerTeamId,
          entered_by: user.id,
        });

      if (insertError) {
        return {
          success: false,
          error: insertError.message,
        };
      }
    }

    // Trigger score recalculation
    // Even if this fails, the result is already saved
    const recalcResult = await triggerRecalculateAllScores();
    
    if (!recalcResult.success) {
      console.error('Score recalculation failed after saving match result:', recalcResult.error);
      // Return success but with a warning about recalculation
      return {
        success: true,
        recalculationError: recalcResult.error || 'Error al recalcular puntajes',
      };
    }

    // Revalidate relevant routes
    revalidatePath('/standings');
    revalidatePath('/groups/[groupId]/leaderboard');
    revalidatePath('/groups/[groupId]/bracket');

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error saving match result:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
