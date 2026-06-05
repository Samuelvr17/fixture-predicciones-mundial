'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { triggerRecalculateAllScores } from './recalculateScores';

const TOURNAMENT_RESULTS_SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

type SaveTournamentResultsParams = {
  topScorerCandidateId: string | null;
  bestGoalkeeperCandidateId: string | null;
};

type SaveTournamentResultsResult = {
  success: boolean;
  error?: string;
  recalculationError?: string;
};

async function validateCandidate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidateId: string | null,
  awardCategory: 'top_scorer' | 'best_goalkeeper'
) {
  if (!candidateId) return { candidate: null, error: null };

  const { data: candidate, error } = await supabase
    .from('award_player_candidates')
    .select('id, display_name, award_categories, is_active')
    .eq('id', candidateId)
    .single();

  if (error || !candidate) {
    return { candidate: null, error: 'El candidato seleccionado no existe.' };
  }

  if (!candidate.is_active) {
    return { candidate: null, error: 'El candidato seleccionado no está activo.' };
  }

  if (!candidate.award_categories.includes(awardCategory)) {
    return { candidate: null, error: 'El candidato seleccionado no corresponde al premio indicado.' };
  }

  return { candidate, error: null };
}

export async function saveTournamentResults(
  params: SaveTournamentResultsParams
): Promise<SaveTournamentResultsResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'User not authenticated' };
  }

  const { data: globalAdminCheck, error: adminError } = await supabase
    .from('global_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !globalAdminCheck) {
    return { success: false, error: 'User is not a global admin' };
  }

  const topScorerValidation = await validateCandidate(supabase, params.topScorerCandidateId, 'top_scorer');
  if (topScorerValidation.error) return { success: false, error: topScorerValidation.error };

  const bestGoalkeeperValidation = await validateCandidate(supabase, params.bestGoalkeeperCandidateId, 'best_goalkeeper');
  if (bestGoalkeeperValidation.error) return { success: false, error: bestGoalkeeperValidation.error };

  const { data: existingResult } = await supabase
    .from('tournament_results')
    .select('id')
    .limit(1)
    .maybeSingle();

  const payload = {
    top_scorer_candidate_id: topScorerValidation.candidate?.id ?? null,
    top_scorer_name: topScorerValidation.candidate?.display_name ?? null,
    best_goalkeeper_candidate_id: bestGoalkeeperValidation.candidate?.id ?? null,
    best_goalkeeper_name: bestGoalkeeperValidation.candidate?.display_name ?? null,
    confirmed_by: user.id,
  };

  const writeResult = existingResult
    ? await supabase.from('tournament_results').update(payload).eq('id', existingResult.id)
    : await supabase.from('tournament_results').insert({ id: TOURNAMENT_RESULTS_SINGLETON_ID, ...payload });

  if (writeResult.error) {
    return { success: false, error: writeResult.error.message };
  }

  const recalcResult = await triggerRecalculateAllScores();
  revalidatePath('/global-admin/tournament-results');
  revalidatePath('/leaderboard');
  revalidatePath('/groups/[groupId]/leaderboard', 'page');

  if (!recalcResult.success) {
    return { success: true, recalculationError: recalcResult.error || 'Error al recalcular puntajes' };
  }

  return { success: true };
}
