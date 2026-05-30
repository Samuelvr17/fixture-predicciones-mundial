/**
 * src/server/actions/saveMatchResult.ts
 *
 * Server action for saving match results and triggering score recalculation.
 * This action is protected to ensure only global admins can save results.
 *
 * For knockout matches:
 * - Teams are resolved dynamically via fetchOfficialBracketData (not from team1_id/team2_id in DB)
 * - winner_team_id is inferred automatically when there is no draw
 * - If it's a draw, winnerTeamId is REQUIRED
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchOfficialBracketData } from '@/lib/tournament/officialBracket';
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
 * 3. For knockout matches, resolves teams via the bracket engine and infers winner from score
 * 4. Triggers score recalculation for all groups
 * 5. Revalidates relevant routes
 * 6. Returns success even if recalculation fails (result is still saved)
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
    // Basic score validations
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
    const isDraw = params.team1Score === params.team2Score;

    // -----------------------------------------------------------------------
    // Determine effective team1/team2 IDs for validation
    // -----------------------------------------------------------------------
    let effectiveTeam1Id: string | null = match.team1_id;
    let effectiveTeam2Id: string | null = match.team2_id;

    if (!isGroupStage) {
      // For knockout, resolve teams dynamically via the bracket engine
      try {
        const bracketData = await fetchOfficialBracketData(supabase);
        const resolved = bracketData.resolvedMatchMap.get(params.matchId);
        if (resolved) {
          effectiveTeam1Id = resolved.team1_id ?? null;
          effectiveTeam2Id = resolved.team2_id ?? null;
        }
      } catch (bracketErr) {
        console.error('Could not resolve bracket teams for match', params.matchId, bracketErr);
        // Non-fatal: fall back to DB values (may be null); validation below will catch issues
      }
    }

    // -----------------------------------------------------------------------
    // Winner validation and auto-inference
    // -----------------------------------------------------------------------
    let finalWinnerTeamId = params.winnerTeamId;

    if (!isGroupStage) {
      if (isDraw) {
        // In knockout, draw requires an explicit winner (penalties/extra time)
        if (!finalWinnerTeamId) {
          return {
            success: false,
            error: 'En eliminatorias con empate, debe seleccionar manualmente el equipo clasificado',
          };
        }
        // Validate the supplied winner is one of the two effective teams
        if (
          effectiveTeam1Id && effectiveTeam2Id &&
          finalWinnerTeamId !== effectiveTeam1Id &&
          finalWinnerTeamId !== effectiveTeam2Id
        ) {
          return {
            success: false,
            error: 'El equipo ganador debe ser uno de los dos equipos del partido',
          };
        }
      } else {
        // No draw: auto-infer winner from score
        const inferredWinnerId =
          params.team1Score > params.team2Score ? effectiveTeam1Id : effectiveTeam2Id;

        if (finalWinnerTeamId) {
          // If the caller passed a winner, it must match the score
          if (inferredWinnerId && finalWinnerTeamId !== inferredWinnerId) {
            return {
              success: false,
              error: 'El equipo ganador no coincide con el marcador del partido',
            };
          }
        } else {
          // Auto-set winner from score
          finalWinnerTeamId = inferredWinnerId;
        }
      }
    } else {
      // Group stage validations
      if (isDraw && finalWinnerTeamId) {
        return {
          success: false,
          error: 'En fase de grupos con empate, no debe haber un equipo ganador',
        };
      }

      // If a winner was supplied for group stage, validate it against DB team IDs
      if (finalWinnerTeamId) {
        if (
          finalWinnerTeamId !== match.team1_id &&
          finalWinnerTeamId !== match.team2_id
        ) {
          return {
            success: false,
            error: 'El equipo ganador debe ser uno de los dos equipos del partido',
          };
        }
      }
    }

    // -----------------------------------------------------------------------
    // Upsert the result
    // -----------------------------------------------------------------------
    const { data: existingResult } = await supabase
      .from('match_results')
      .select('id')
      .eq('match_id', params.matchId)
      .single();

    if (existingResult) {
      const { error: updateError } = await supabase
        .from('match_results')
        .update({
          team1_score: params.team1Score,
          team2_score: params.team2Score,
          winner_team_id: finalWinnerTeamId,
        })
        .eq('id', existingResult.id);

      if (updateError) {
        return {
          success: false,
          error: updateError.message,
        };
      }
    } else {
      const { error: insertError } = await supabase
        .from('match_results')
        .insert({
          match_id: params.matchId,
          team1_score: params.team1Score,
          team2_score: params.team2Score,
          winner_team_id: finalWinnerTeamId,
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
    const recalcResult = await triggerRecalculateAllScores();

    if (!recalcResult.success) {
      console.error('Score recalculation failed after saving match result:', recalcResult.error);
      return {
        success: true,
        recalculationError: recalcResult.error || 'Error al recalcular puntajes',
      };
    }

    // Revalidate relevant routes
    revalidatePath('/standings');
    revalidatePath('/groups/[groupId]/leaderboard', 'page');
    revalidatePath('/groups/[groupId]/bracket', 'page');

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
