/**
 * src/server/scoring/recalculateScores.ts
 *
 * Server-side score recalculation functions.
 * These functions load predictions, calculate scores using the scoring engine,
 * and save results to score_breakdowns table.
 *
 * All calculations are done server-side to ensure integrity and prevent
 * client-side manipulation of scores.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateScore, type KnockoutMatchup, type MatchPrediction, type PredictionAdvance, type PredictionSpecial, type Match, type MatchResult, type ResolvedBracket, type TournamentRound } from '@/lib/scoring/scoring';
import { calculateGroupStandings, type Team as TournamentTeam, type Match as TournamentMatch, type MatchResult as TournamentMatchResult, type ManualTiebreak as GroupTiebreak } from '@/lib/tournament/groupStandings';
import { calculateBestThirds, type ManualTiebreak as BestThirdsTiebreak, type BestThirdsOutput } from '@/lib/tournament/bestThirds';
import { resolveBracket, type Match as BracketMatch, type MatchResult as BracketMatchResult, type ManualTiebreak as BracketTiebreak } from '@/lib/tournament/bracket';
import { buildTeamAdvancesFromBracket } from '@/lib/tournament/teamAdvances';
import { buildPredictedTournamentFromScores } from '@/lib/tournament/predictedTournament';
import type { Database } from '@/types/database.types';

// ============================================================================
// Types
// ============================================================================

interface RecalculationResult {
  groupId: string;
  success: boolean;
  error?: string;
  usersProcessed: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert database match to scoring engine match format
 */
function dbMatchToScoringMatch(dbMatch: Database['public']['Tables']['matches']['Row']): Match {
  return {
    id: dbMatch.id,
    round: dbMatch.round,
    team1_id: dbMatch.team1_id,
    team2_id: dbMatch.team2_id,
  };
}

/**
 * Convert database match result to scoring engine match result format
 */
function dbMatchResultToScoringMatchResult(dbResult: Database['public']['Tables']['match_results']['Row']): MatchResult {
  return {
    match_id: dbResult.match_id,
    team1_score: dbResult.team1_score,
    team2_score: dbResult.team2_score,
    winner_team_id: dbResult.winner_team_id,
  };
}

/**
 * Convert database prediction score to scoring engine match prediction format
 */
function dbPredictionToMatchPrediction(dbPrediction: Database['public']['Tables']['predictions_scores']['Row']): MatchPrediction {
  return {
    match_id: dbPrediction.match_id,
    predicted_team1_score: dbPrediction.predicted_team1_score,
    predicted_team2_score: dbPrediction.predicted_team2_score,
    predicted_winner_team_id: dbPrediction.predicted_winner_team_id,
  };
}

/**
 * Convert database prediction advance to scoring engine prediction advance format
 */
function dbPredictionToPredictionAdvance(dbPrediction: Database['public']['Tables']['predictions_advances']['Row']): PredictionAdvance {
  return {
    team_id: dbPrediction.team_id,
    predicted_round: dbPrediction.predicted_round,
  };
}

/**
 * Convert database prediction special to scoring engine prediction special format
 */
function dbPredictionToPredictionSpecial(dbPrediction: Database['public']['Tables']['predictions_specials']['Row']): PredictionSpecial {
  return {
    champion_team_id: dbPrediction.champion_team_id,
    third_place_team_id: dbPrediction.third_place_team_id,
    top_scorer_name: dbPrediction.top_scorer_name,
    top_scorer_candidate_id: dbPrediction.top_scorer_candidate_id,
    best_goalkeeper_candidate_id: dbPrediction.best_goalkeeper_candidate_id,
    best_goalkeeper_name: dbPrediction.best_goalkeeper_name,
  };
}

/**
 * Convert database team to tournament engine team format
 */
function dbTeamToTournamentTeam(dbTeam: Database['public']['Tables']['teams']['Row']): TournamentTeam {
  return {
    id: dbTeam.id,
    name: dbTeam.name,
    code: dbTeam.code,
    group_code: dbTeam.group_code || '',
  };
}

/**
 * Convert database match to tournament engine match format
 */
function dbMatchToTournamentMatch(dbMatch: Database['public']['Tables']['matches']['Row']): TournamentMatch {
  return {
    id: dbMatch.id,
    team1_id: dbMatch.team1_id || '',
    team2_id: dbMatch.team2_id || '',
    group_code: dbMatch.group_code || '',
    round: dbMatch.round === 'group' ? 'group' : 'group', // TournamentMatch only supports 'group' round
  };
}

/**
 * Convert database match result to tournament engine match result format
 */
function dbMatchResultToTournamentMatchResult(dbResult: Database['public']['Tables']['match_results']['Row']): TournamentMatchResult {
  return {
    match_id: dbResult.match_id,
    team1_score: dbResult.team1_score,
    team2_score: dbResult.team2_score,
  };
}

/**
 * Convert database match to bracket engine match format
 */
function dbMatchToBracketMatch(dbMatch: Database['public']['Tables']['matches']['Row']): BracketMatch {
  return {
    id: dbMatch.id,
    num: dbMatch.match_number ?? undefined,
    round: dbMatch.round as any, // Type assertion needed due to enum differences
    date: dbMatch.match_date,
    time: dbMatch.match_time,
    ground: dbMatch.venue,
    team1_id: dbMatch.team1_id ?? undefined,
    team2_id: dbMatch.team2_id ?? undefined,
    team1_slot: dbMatch.team1_slot as any, // Type assertion for Slot
    team2_slot: dbMatch.team2_slot as any, // Type assertion for Slot
  };
}

/**
 * Convert database match result to bracket engine match result format
 */
function dbMatchResultToBracketMatchResult(dbResult: Database['public']['Tables']['match_results']['Row']): BracketMatchResult {
  return {
    match_id: dbResult.match_id,
    team1_score: dbResult.team1_score,
    team2_score: dbResult.team2_score,
    winner_team_id: dbResult.winner_team_id ?? undefined,
  };
}

function buildKnockoutMatchupMap(
  resolvedMatches: Array<{
    match: { id: string };
    team1_id?: string;
    team2_id?: string;
    winner_team_id?: string;
  }>,
): Map<string, KnockoutMatchup> {
  const matchups = new Map<string, KnockoutMatchup>();

  for (const resolvedMatch of resolvedMatches) {
    if (resolvedMatch.team1_id && resolvedMatch.team2_id) {
      matchups.set(resolvedMatch.match.id, {
        team1_id: resolvedMatch.team1_id,
        team2_id: resolvedMatch.team2_id,
        winner_team_id: resolvedMatch.winner_team_id ?? null,
      });
    }
  }

  return matchups;
}

// ============================================================================
// Main Recalculation Functions
// ============================================================================

/**
 * Recalculate scores for all members of a specific group
 * 
 * This function:
 * 1. Loads all global data (matches, match_results, teams)
 * 2. Calculates group standings, best thirds, and resolved bracket
 * 3. For each member of the group, loads their predictions
 * 4. Calculates scores using the scoring engine
 * 5. Saves/updates score_breakdowns using upsert (idempotent)
 * 
 * @param groupId - The ID of the group to recalculate
 * @returns Result with success status and number of users processed
 */
export async function recalculateGroupScores(groupId: string): Promise<RecalculationResult> {
  const supabase = createServiceRoleClient();

  try {
    // Load global data
    const [teamsData, matchesData, matchResultsData, manualTiebreaksData, tournamentResultsData] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('match_results').select('*'),
      supabase.from('manual_tiebreaks').select('*'),
      supabase.from('tournament_results').select('*').maybeSingle(),
    ]);

    if (teamsData.error) throw teamsData.error;
    if (matchesData.error) throw matchesData.error;
    if (matchResultsData.error) throw matchResultsData.error;
    if (manualTiebreaksData.error) throw manualTiebreaksData.error;
    // tournament_results might not exist yet, that's ok
    const tournamentResults = tournamentResultsData.data || { champion_team_id: null, third_place_team_id: null, top_scorer_name: null, top_scorer_candidate_id: null, best_goalkeeper_candidate_id: null, best_goalkeeper_name: null };

    // Convert to tournament engine formats
    const tournamentTeams = teamsData.data.map(dbTeamToTournamentTeam);
    const tournamentMatches = matchesData.data
      .filter(m => m.round === 'group')
      .map(dbMatchToTournamentMatch);
    const tournamentMatchResults = matchResultsData.data.map(dbMatchResultToTournamentMatchResult);

    // Load manual tiebreaks for groups
    const groupTiebreaks: GroupTiebreak[] = manualTiebreaksData.data
      .filter(tb => tb.type === 'group_tiebreak')
      .map(tb => ({
        type: 'group' as const,
        reference: tb.reference,
        ordered_team_ids: tb.ordered_team_ids,
      }));

    // Calculate group standings
    const groupStandings = calculateGroupStandings(tournamentTeams, tournamentMatches, tournamentMatchResults, groupTiebreaks);

    // Load manual tiebreaks for best thirds
    const bestThirdsTiebreak = manualTiebreaksData.data
      .find(tb => tb.type === 'best_thirds') as BestThirdsTiebreak | undefined;

    // Calculate best thirds
    const bestThirds = calculateBestThirds(groupStandings.thirdPlaceTeams, bestThirdsTiebreak);

    // Load bracket matches (knockout stage)
    const bracketMatches = matchesData.data
      .filter(m => m.round !== 'group')
      .map(dbMatchToBracketMatch);
    const bracketMatchResults = matchResultsData.data.map(dbMatchResultToBracketMatchResult);

    // Load manual tiebreaks for bracket
    const bracketGroupTiebreaks = manualTiebreaksData.data
      .filter(tb => tb.type === 'group_tiebreak') as BracketTiebreak[];

    // Resolve bracket
    const bracketOutput = resolveBracket(
      bracketMatches,
      bracketMatchResults,
      groupStandings,
      bestThirds,
      bracketGroupTiebreaks
    );

    // Build team advances map
    const teamAdvances = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    // Build resolved bracket for scoring engine
    const resolvedBracket: ResolvedBracket = {
      champion_team_id: bracketOutput.champion || tournamentResults.champion_team_id,
      third_place_team_id: bracketOutput.thirdPlace || tournamentResults.third_place_team_id,
      official_top_scorer: tournamentResults.top_scorer_name,
      official_top_scorer_candidate_id: tournamentResults.top_scorer_candidate_id,
      official_best_goalkeeper_candidate_id: tournamentResults.best_goalkeeper_candidate_id,
      official_best_goalkeeper: tournamentResults.best_goalkeeper_name,
      team_advances: teamAdvances,
    };

    // Convert to scoring engine formats
    const scoringMatches = matchesData.data.map(dbMatchToScoringMatch);
    const scoringMatchResults = matchResultsData.data.map(dbMatchResultToScoringMatchResult);
    const officialKnockoutMatchups = buildKnockoutMatchupMap(bracketOutput.matches);

    // Load group members
    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (membersError) throw membersError;

    const userIds = membersData.map(m => m.user_id);
    let usersProcessed = 0;

    // Process each member
    for (const userId of userIds) {
      // Load predictions for this user in this group
      const [
        predictionsScoresData,
        predictionsAdvancesData,
        predictionsSpecialsData,
        predictionManualTiebreaksData,
      ] = await Promise.all([
        supabase
          .from('predictions_scores')
          .select('*')
          .eq('group_id', groupId)
          .eq('user_id', userId),
        supabase
          .from('predictions_advances')
          .select('*')
          .eq('group_id', groupId)
          .eq('user_id', userId),
        supabase
          .from('predictions_specials')
          .select('*')
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .single(),
        supabase
          .from('prediction_manual_tiebreaks')
          .select('*')
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .eq('type', 'group_tiebreak'),
      ]);

      if (predictionsScoresData.error) throw predictionsScoresData.error;
      if (predictionsAdvancesData.error) throw predictionsAdvancesData.error;
      if (predictionManualTiebreaksData.error) throw predictionManualTiebreaksData.error;
      // predictions_specials might not exist for this user
      let predictionsSpecials: Database['public']['Tables']['predictions_specials']['Row'];
      if (predictionsSpecialsData.error || !predictionsSpecialsData.data) {
        predictionsSpecials = {
          id: '',
          group_id: groupId,
          user_id: userId,
          champion_team_id: null,
          third_place_team_id: null,
          top_scorer_name: null,
          top_scorer_candidate_id: null,
          top_scorer_other_name: null,
          top_scorer_other_team_id: null,
          best_goalkeeper_candidate_id: null,
          best_goalkeeper_name: null,
          best_goalkeeper_other_name: null,
          best_goalkeeper_other_team_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        predictionsSpecials = predictionsSpecialsData.data;
      }

      // Convert to scoring engine formats
      const matchPredictions = predictionsScoresData.data.map(dbPredictionToMatchPrediction);
      const predictionAdvances = predictionsAdvancesData.data.map(dbPredictionToPredictionAdvance);
      const predictionSpecials = dbPredictionToPredictionSpecial(predictionsSpecials);
      const groupManualTiebreaks = (predictionManualTiebreaksData.data || []).map((tiebreak) => ({
        type: 'group' as const,
        reference: tiebreak.reference.startsWith('group_')
          ? tiebreak.reference
          : `group_${tiebreak.reference}`,
        ordered_team_ids: tiebreak.ordered_team_ids,
      }));
      const predictedTournament = buildPredictedTournamentFromScores(
        teamsData.data.map((team) => ({
          id: team.id,
          name: team.name,
          code: team.code,
          group_code: team.group_code,
        })),
        matchesData.data.map((match) => ({
          id: match.id,
          match_number: match.match_number,
          round: match.round,
          group_code: match.group_code,
          match_date: match.match_date,
          match_time: match.match_time,
          venue: match.venue,
          team1_id: match.team1_id,
          team2_id: match.team2_id,
          team1_slot: match.team1_slot,
          team2_slot: match.team2_slot,
        })),
        matchPredictions,
        groupManualTiebreaks
      );
      const predictedKnockoutMatchups = buildKnockoutMatchupMap(predictedTournament.bracket.matches);

      // Calculate score
      const scoreBreakdown = calculateScore({
        group_id: groupId,
        user_id: userId,
        match_predictions: matchPredictions,
        predicted_team_advances: predictedTournament.teamAdvances,
        predicted_champion_team_id: predictedTournament.championTeamId,
        predicted_third_place_team_id: predictedTournament.thirdPlaceTeamId,
        predictions_advances: predictionAdvances,
        predictions_specials: predictionSpecials,
        matches: scoringMatches,
        match_results: scoringMatchResults,
        resolvedBracket,
        official_knockout_matchups: officialKnockoutMatchups,
        predicted_knockout_matchups: predictedKnockoutMatchups,
      });

      // Save to score_breakdowns (upsert by group_id, user_id)
      const { error: upsertError } = await supabase
        .from('score_breakdowns')
        .upsert({
          group_id: groupId,
          user_id: userId,
          exact_scores_group_stage: scoreBreakdown.groupStageExactPoints,
          correct_results_group_stage: scoreBreakdown.groupStageOutcomePoints,
          exact_scores_knockout: scoreBreakdown.knockoutExactPoints,
          advances_points: scoreBreakdown.advancementPoints,
          champion_points: scoreBreakdown.championPoints,
          third_place_points: scoreBreakdown.thirdPlacePoints,
          top_scorer_points: scoreBreakdown.topScorerPoints,
          best_goalkeeper_points: scoreBreakdown.bestGoalkeeperPoints,
          total_points: scoreBreakdown.total,
          details: scoreBreakdown.details || {},
          last_calculated_at: new Date().toISOString(),
        }, {
          onConflict: 'group_id,user_id',
        });

      if (upsertError) throw upsertError;

      usersProcessed++;
    }

    return {
      groupId,
      success: true,
      usersProcessed,
    };
  } catch (error) {
    console.error(`Error recalculating scores for group ${groupId}:`, error);
    return {
      groupId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      usersProcessed: 0,
    };
  }
}

/**
 * Recalculate scores for all active groups
 * 
 * This function:
 * 1. Gets all active groups
 * 2. Executes recalculateGroupScores for each group
 * 
 * @returns Array of results for each group
 */
export async function recalculateAllGroupScores(): Promise<RecalculationResult[]> {
  const supabase = createServiceRoleClient();

  try {
    // Load all active groups
    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('id')
      .eq('is_active', true);

    if (groupsError) throw groupsError;

    if (!groupsData || groupsData.length === 0) {
      return [];
    }

    const results: RecalculationResult[] = [];

    // Recalculate each group
    for (const group of groupsData) {
      const result = await recalculateGroupScores(group.id);
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error('Error recalculating all group scores:', error);
    throw error;
  }
}
