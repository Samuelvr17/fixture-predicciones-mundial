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

import { createClient } from '@/lib/supabase/server';
import { calculateScore, type MatchPrediction, type PredictionAdvance, type PredictionSpecial, type Match, type MatchResult, type ResolvedBracket, type TournamentRound } from '@/lib/scoring/scoring';
import { calculateGroupStandings, type Team as TournamentTeam, type Match as TournamentMatch, type MatchResult as TournamentMatchResult } from '@/lib/tournament/groupStandings';
import { calculateBestThirds, type ManualTiebreak as BestThirdsTiebreak } from '@/lib/tournament/bestThirds';
import { resolveBracket, type Match as BracketMatch, type MatchResult as BracketMatchResult, type ManualTiebreak as BracketTiebreak } from '@/lib/tournament/bracket';
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

/**
 * Build team advances map from bracket output
 * This maps each team to the furthest round they reached
 */
function buildTeamAdvancesFromBracket(
  bracketOutput: ReturnType<typeof resolveBracket>,
  groupStandings: ReturnType<typeof calculateGroupStandings>
): Record<string, TournamentRound> {
  const teamAdvances: Record<string, TournamentRound> = {};

  // Start with all teams at 'no_clasifica'
  for (const groupCode in groupStandings.standings) {
    const group = groupStandings.standings[groupCode];
    for (const team of group.standings) {
      teamAdvances[team.team_id] = 'no_clasifica';
    }
  }

  // Update based on bracket matches
  // Teams that won in round_of_32 reached round_of_16
  // Teams that won in round_of_16 reached quarter_final
  // etc.
  for (const resolvedMatch of bracketOutput.matches) {
    if (resolvedMatch.winner_team_id) {
      const currentRound = resolvedMatch.match.round;
      const winnerId = resolvedMatch.winner_team_id;

      // Map round to tournament round
      const roundMap: Record<string, TournamentRound> = {
        'round_of_32': 'round_of_16',
        'round_of_16': 'quarter_final',
        'quarter_final': 'semi_final',
        'semi_final': 'final',
        'final': 'champion',
        'third_place': 'champion', // Third place match winner is considered champion for advancement purposes
      };

      const nextRound = roundMap[currentRound];
      if (nextRound) {
        // Only update if this is a further round than what they already have
        const roundOrder = ['no_clasifica', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'champion'];
        const currentIndex = roundOrder.indexOf(teamAdvances[winnerId] || 'no_clasifica');
        const newIndex = roundOrder.indexOf(nextRound);
        if (newIndex > currentIndex) {
          teamAdvances[winnerId] = nextRound;
        }
      }
    }
  }

  // Teams in round_of_32 (qualified from group stage)
  for (const groupCode in groupStandings.standings) {
    const group = groupStandings.standings[groupCode];
    // First and second place teams qualify for round_of_32
    if (group.standings.length >= 2) {
      teamAdvances[group.standings[0].team_id] = 'round_of_32';
      teamAdvances[group.standings[1].team_id] = 'round_of_32';
    }
  }

  // Best thirds also qualify for round_of_32
  for (const team of groupStandings.thirdPlaceTeams) {
    teamAdvances[team.team_id] = 'round_of_32';
  }

  return teamAdvances;
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
  const supabase = await createClient();

  try {
    // Load global data
    const [teamsData, matchesData, matchResultsData, manualTiebreaksData, tournamentResultsData] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('match_results').select('*'),
      supabase.from('manual_tiebreaks').select('*'),
      supabase.from('tournament_results').select('*').single(),
    ]);

    if (teamsData.error) throw teamsData.error;
    if (matchesData.error) throw matchesData.error;
    if (matchResultsData.error) throw matchResultsData.error;
    if (manualTiebreaksData.error) throw manualTiebreaksData.error;
    // tournament_results might not exist yet, that's ok
    const tournamentResults = tournamentResultsData.data || { champion_team_id: null, third_place_team_id: null, top_scorer_name: null };

    // Convert to tournament engine formats
    const tournamentTeams = teamsData.data.map(dbTeamToTournamentTeam);
    const tournamentMatches = matchesData.data
      .filter(m => m.round === 'group')
      .map(dbMatchToTournamentMatch);
    const tournamentMatchResults = matchResultsData.data.map(dbMatchResultToTournamentMatchResult);

    // Calculate group standings
    const groupStandings = calculateGroupStandings(tournamentTeams, tournamentMatches, tournamentMatchResults);

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

    // Load manual tiebreaks for groups
    const groupTiebreaks = manualTiebreaksData.data
      .filter(tb => tb.type === 'group_tiebreak') as BracketTiebreak[];

    // Resolve bracket
    const bracketOutput = resolveBracket(
      bracketMatches,
      bracketMatchResults,
      groupStandings,
      bestThirds,
      groupTiebreaks
    );

    // Build team advances map
    const teamAdvances = buildTeamAdvancesFromBracket(bracketOutput, groupStandings);

    // Build resolved bracket for scoring engine
    const resolvedBracket: ResolvedBracket = {
      champion_team_id: bracketOutput.champion || tournamentResults.champion_team_id,
      third_place_team_id: bracketOutput.thirdPlace || tournamentResults.third_place_team_id,
      official_top_scorer: tournamentResults.top_scorer_name,
      team_advances: teamAdvances,
    };

    // Convert to scoring engine formats
    const scoringMatches = matchesData.data.map(dbMatchToScoringMatch);
    const scoringMatchResults = matchResultsData.data.map(dbMatchResultToScoringMatchResult);

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
      const [predictionsScoresData, predictionsAdvancesData, predictionsSpecialsData] = await Promise.all([
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
      ]);

      if (predictionsScoresData.error) throw predictionsScoresData.error;
      if (predictionsAdvancesData.error) throw predictionsAdvancesData.error;
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

      // Calculate score
      const scoreBreakdown = calculateScore({
        group_id: groupId,
        user_id: userId,
        match_predictions: matchPredictions,
        predictions_advances: predictionAdvances,
        predictions_specials: predictionSpecials,
        matches: scoringMatches,
        match_results: scoringMatchResults,
        resolvedBracket,
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
  const supabase = await createClient();

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
