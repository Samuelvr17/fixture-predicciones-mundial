#!/usr/bin/env npx tsx
/**
 * Read-only audit: predicted bracket consistency for a specific group.
 *
 * Reconstructs each user's predictedTournament using the same logic as
 * recalculateGroupScores (src/server/scoring/recalculateScores.ts) and
 * validates that predicted winners and bracket propagation are consistent.
 *
 * Validates:
 * - predicted_winner_team_id in predictions_scores matches the actual teams in the reconstructed match
 * - inferred winners from scores match the actual teams in the reconstructed match
 * - participants in future rounds correspond to actual winners from previous matches
 *
 * Usage:
 *   npx tsx scripts/audit-predicted-bracket-consistency.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import ws from 'ws';
import {
  type MatchPrediction,
  type PredictionAdvance,
  type PredictionSpecial,
} from '../src/lib/scoring/scoring';
import {
  calculateGroupStandings,
  type Team as TournamentTeam,
  type Match as TournamentMatch,
  type MatchResult as TournamentMatchResult,
  type ManualTiebreak as GroupTiebreak,
} from '../src/lib/tournament/groupStandings';
import {
  calculateBestThirds,
  type ManualTiebreak as BestThirdsTiebreak,
  type BestThirdsOutput,
} from '../src/lib/tournament/bestThirds';
import {
  resolveBracket,
  type Match as BracketMatch,
  type MatchResult as BracketMatchResult,
  type ManualTiebreak as BracketTiebreak,
  type BracketOutput,
} from '../src/lib/tournament/bracket';
import { buildTeamAdvancesFromBracket } from '../src/lib/tournament/teamAdvances';
import {
  buildPredictedTournamentFromScores,
  type PredictedTournamentMatch,
  type PredictedTournamentTeam,
} from '../src/lib/tournament/predictedTournament';
import type { Database } from '../src/types/database.types';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

// @ts-ignore - ws transport type issue
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: ws as any,
  },
});

const GROUP_ID = 'b86590c1-8ef2-448b-b93a-4233a4af5227';

type TeamRow = Database['public']['Tables']['teams']['Row'];
type MatchRow = Database['public']['Tables']['matches']['Row'];
type MatchResultRow = Database['public']['Tables']['match_results']['Row'];
type PredictionScoreRow = Database['public']['Tables']['predictions_scores']['Row'];
type PredictionAdvanceRow = Database['public']['Tables']['predictions_advances']['Row'];
type PredictionSpecialRow = Database['public']['Tables']['predictions_specials']['Row'];
type PredictionManualTiebreakRow =
  Database['public']['Tables']['prediction_manual_tiebreaks']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ManualTiebreakRow = Database['public']['Tables']['manual_tiebreaks']['Row'];
type TournamentResultsRow = Database['public']['Tables']['tournament_results']['Row'];

interface InconsistencyRow {
  email: string;
  username: string;
  match_number: number | null;
  round: string;
  team1_code: string;
  team2_code: string;
  predicted_team1_score: number | null;
  predicted_team2_score: number | null;
  raw_predicted_winner_code: string | null;
  inferred_or_effective_winner_code: string | null;
  reason: string;
}

interface UserPredictionBundle {
  matchPredictions: MatchPrediction[];
  predictionAdvances: PredictionAdvance[];
  predictionSpecials: PredictionSpecial;
  groupManualTiebreaks: GroupTiebreak[];
  predictionsScores: PredictionScoreRow[];
}

interface PredictedContext {
  predictedTournamentTeams: PredictedTournamentTeam[];
  predictedTournamentMatches: PredictedTournamentMatch[];
}

// ============================================================================
// Helpers mirrored from src/server/scoring/recalculateScores.ts
// ============================================================================

function dbPredictionToMatchPrediction(dbPrediction: PredictionScoreRow): MatchPrediction {
  return {
    match_id: dbPrediction.match_id,
    predicted_team1_score: dbPrediction.predicted_team1_score,
    predicted_team2_score: dbPrediction.predicted_team2_score,
    predicted_winner_team_id: dbPrediction.predicted_winner_team_id,
  };
}

function dbPredictionToPredictionAdvance(dbPrediction: PredictionAdvanceRow): PredictionAdvance {
  return {
    team_id: dbPrediction.team_id,
    predicted_round: dbPrediction.predicted_round,
  };
}

function dbPredictionToPredictionSpecial(dbPrediction: PredictionSpecialRow): PredictionSpecial {
  return {
    champion_team_id: dbPrediction.champion_team_id,
    third_place_team_id: dbPrediction.third_place_team_id,
    top_scorer_name: dbPrediction.top_scorer_name,
    top_scorer_candidate_id: dbPrediction.top_scorer_candidate_id,
    best_goalkeeper_candidate_id: dbPrediction.best_goalkeeper_candidate_id,
    best_goalkeeper_name: dbPrediction.best_goalkeeper_name,
  };
}

function dbTeamToTournamentTeam(dbTeam: TeamRow): TournamentTeam {
  return {
    id: dbTeam.id,
    name: dbTeam.name,
    code: dbTeam.code,
    group_code: dbTeam.group_code || '',
  };
}

function dbMatchToTournamentMatch(dbMatch: MatchRow): TournamentMatch {
  return {
    id: dbMatch.id,
    team1_id: dbMatch.team1_id || '',
    team2_id: dbMatch.team2_id || '',
    group_code: dbMatch.group_code || '',
    round: 'group',
  };
}

function dbMatchResultToTournamentMatchResult(dbResult: MatchResultRow): TournamentMatchResult {
  return {
    match_id: dbResult.match_id,
    team1_score: dbResult.team1_score,
    team2_score: dbResult.team2_score,
  };
}

function dbMatchToBracketMatch(dbMatch: MatchRow): BracketMatch {
  return {
    id: dbMatch.id,
    num: dbMatch.match_number ?? undefined,
    round: dbMatch.round as BracketMatch['round'],
    date: dbMatch.match_date,
    time: dbMatch.match_time,
    ground: dbMatch.venue,
    team1_id: dbMatch.team1_id ?? undefined,
    team2_id: dbMatch.team2_id ?? undefined,
    team1_slot: dbMatch.team1_slot as BracketMatch['team1_slot'],
    team2_slot: dbMatch.team2_slot as BracketMatch['team2_slot'],
  };
}

function dbMatchResultToBracketMatchResult(dbResult: MatchResultRow): BracketMatchResult {
  return {
    match_id: dbResult.match_id,
    team1_score: dbResult.team1_score,
    team2_score: dbResult.team2_score,
    winner_team_id: dbResult.winner_team_id ?? undefined,
  };
}

function dbMatchToPredictedTournamentMatch(dbMatch: MatchRow): PredictedTournamentMatch {
  return {
    id: dbMatch.id,
    match_number: dbMatch.match_number,
    round: dbMatch.round as PredictedTournamentMatch['round'],
    group_code: dbMatch.group_code,
    match_date: dbMatch.match_date,
    match_time: dbMatch.match_time,
    venue: dbMatch.venue,
    team1_id: dbMatch.team1_id,
    team2_id: dbMatch.team2_id,
    team1_slot: dbMatch.team1_slot,
    team2_slot: dbMatch.team2_slot,
  };
}

function emptyPredictionSpecial(userId: string): PredictionSpecialRow {
  return {
    id: '',
    group_id: GROUP_ID,
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
}

function buildPredictedContext(
  teams: TeamRow[],
  matches: MatchRow[],
  matchResults: MatchResultRow[],
  manualTiebreaks: ManualTiebreakRow[],
  tournamentResults: Pick<
    TournamentResultsRow,
    | 'champion_team_id'
    | 'third_place_team_id'
    | 'top_scorer_name'
    | 'top_scorer_candidate_id'
    | 'best_goalkeeper_candidate_id'
    | 'best_goalkeeper_name'
  >,
): PredictedContext {
  const tournamentTeams = teams.map(dbTeamToTournamentTeam);
  const tournamentMatches = matches
    .filter((match) => match.round === 'group')
    .map(dbMatchToTournamentMatch);
  const tournamentMatchResults = matchResults.map(dbMatchResultToTournamentMatchResult);

  const groupTiebreaks: GroupTiebreak[] = manualTiebreaks
    .filter((tiebreak) => tiebreak.type === 'group_tiebreak')
    .map((tiebreak) => ({
      type: 'group' as const,
      reference: tiebreak.reference,
      ordered_team_ids: tiebreak.ordered_team_ids,
    }));

  const groupStandings = calculateGroupStandings(
    tournamentTeams,
    tournamentMatches,
    tournamentMatchResults,
    groupTiebreaks,
  );

  const bestThirdsTiebreak = manualTiebreaks.find(
    (tiebreak) => tiebreak.type === 'best_thirds',
  ) as BestThirdsTiebreak | undefined;

  const bestThirds: BestThirdsOutput = calculateBestThirds(
    groupStandings.thirdPlaceTeams,
    bestThirdsTiebreak,
  );

  const bracketMatches = matches
    .filter((match) => match.round !== 'group')
    .map(dbMatchToBracketMatch);
  const bracketMatchResults = matchResults.map(dbMatchResultToBracketMatchResult);

  const bracketGroupTiebreaks = manualTiebreaks.filter(
    (tiebreak) => tiebreak.type === 'group_tiebreak',
  ) as BracketTiebreak[];

  const bracketOutput = resolveBracket(
    bracketMatches,
    bracketMatchResults,
    groupStandings,
    bestThirds,
    bracketGroupTiebreaks,
  );

  return {
    predictedTournamentTeams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      code: team.code,
      group_code: team.group_code,
    })),
    predictedTournamentMatches: matches.map(dbMatchToPredictedTournamentMatch),
  };
}

async function loadUserPredictionsLikeRecalculate(
  userId: string,
): Promise<UserPredictionBundle> {
  const [
    predictionsScoresData,
    predictionsAdvancesData,
    predictionsSpecialsData,
    predictionManualTiebreaksData,
  ] = await Promise.all([
    supabase
      .from('predictions_scores')
      .select('*')
      .eq('group_id', GROUP_ID)
      .eq('user_id', userId),
    supabase
      .from('predictions_advances')
      .select('*')
      .eq('group_id', GROUP_ID)
      .eq('user_id', userId),
    supabase
      .from('predictions_specials')
      .select('*')
      .eq('group_id', GROUP_ID)
      .eq('user_id', userId)
      .single(),
    supabase
      .from('prediction_manual_tiebreaks')
      .select('*')
      .eq('group_id', GROUP_ID)
      .eq('user_id', userId)
      .eq('type', 'group_tiebreak'),
  ]);

  if (predictionsScoresData.error) throw predictionsScoresData.error;
  if (predictionsAdvancesData.error) throw predictionsAdvancesData.error;
  if (predictionManualTiebreaksData.error) throw predictionManualTiebreaksData.error;

  let predictionsSpecials: PredictionSpecialRow;
  if (predictionsSpecialsData.error || !predictionsSpecialsData.data) {
    predictionsSpecials = emptyPredictionSpecial(userId);
  } else {
    predictionsSpecials = predictionsSpecialsData.data;
  }

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

  return {
    matchPredictions,
    predictionAdvances,
    predictionSpecials,
    groupManualTiebreaks,
    predictionsScores: predictionsScoresData.data,
  };
}

async function loadUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const emailByUserId = new Map<string, string>();
  const wanted = new Set(userIds);
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    for (const user of data.users) {
      if (wanted.has(user.id)) {
        emailByUserId.set(user.id, user.email ?? '(sin email)');
      }
    }

    if (emailByUserId.size >= wanted.size || data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  for (const userId of userIds) {
    if (!emailByUserId.has(userId)) {
      emailByUserId.set(userId, '(sin email)');
    }
  }

  return emailByUserId;
}

function isKnockoutRound(round: string): boolean {
  return round !== 'group';
}

function inferWinnerFromScore(
  team1Score: number | null,
  team2Score: number | null,
): string | null {
  if (team1Score === null || team2Score === null) {
    return null;
  }
  if (team1Score > team2Score) {
    return 'team1';
  }
  if (team2Score > team1Score) {
    return 'team2';
  }
  return null; // tie
}

function getTeamCode(teamId: string | null | undefined, teamById: Map<string, TeamRow>): string {
  if (!teamId) return '(null)';
  const team = teamById.get(teamId);
  return team?.code ?? teamId;
}

async function main() {
  console.log('Predicted bracket consistency audit (read-only)');
  console.log(`Group: ${GROUP_ID}`);
  console.log('');

  const [
    teamsData,
    matchesData,
    matchResultsData,
    manualTiebreaksData,
    tournamentResultsData,
    globalAdminsData,
    membersData,
  ] = await Promise.all([
    supabase.from('teams').select('*'),
    supabase.from('matches').select('*'),
    supabase.from('match_results').select('*'),
    supabase.from('manual_tiebreaks').select('*'),
    supabase.from('tournament_results').select('*').maybeSingle(),
    supabase.from('global_admins').select('user_id'),
    supabase
      .from('group_members')
      .select(`
        user_id,
        hidden_from_leaderboard,
        profiles!group_members_user_id_fkey (
          id,
          username
        )
      `)
      .eq('group_id', GROUP_ID),
  ]);

  if (teamsData.error) throw teamsData.error;
  if (matchesData.error) throw matchesData.error;
  if (matchResultsData.error) throw matchResultsData.error;
  if (manualTiebreaksData.error) throw manualTiebreaksData.error;
  if (globalAdminsData.error) throw globalAdminsData.error;
  if (membersData.error) throw membersData.error;

  const teams = teamsData.data as TeamRow[];
  const matches = matchesData.data as MatchRow[];
  const matchResults = matchResultsData.data as MatchResultRow[];
  const tournamentResults = tournamentResultsData.data ?? {
    champion_team_id: null,
    third_place_team_id: null,
    top_scorer_name: null,
    top_scorer_candidate_id: null,
    best_goalkeeper_candidate_id: null,
    best_goalkeeper_name: null,
  };

  const predictedContext = buildPredictedContext(
    teams,
    matches,
    matchResults,
    manualTiebreaksData.data as ManualTiebreakRow[],
    tournamentResults,
  );

  const globalAdminIds = new Set((globalAdminsData.data ?? []).map((admin) => admin.user_id));

  const visibleMembers = (membersData.data ?? []).filter((member) => {
    if (globalAdminIds.has(member.user_id)) {
      return false;
    }
    return !member.hidden_from_leaderboard;
  });

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const emailByUserId = await loadUserEmails(visibleMembers.map((member) => member.user_id));
  
  const inconsistencies: InconsistencyRow[] = [];
  let matchesChecked = 0;
  let invalidWinnersFound = 0;
  let invalidPropagatedParticipantsFound = 0;

  for (const member of visibleMembers) {
    const userId = member.user_id;
    const profileRaw = member.profiles;
    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as ProfileRow | null;
    const username = profile?.username ?? '(sin username)';
    const email = emailByUserId.get(userId) ?? '(sin email)';

    const predictions = await loadUserPredictionsLikeRecalculate(userId);

    const predictedTournament = buildPredictedTournamentFromScores(
      predictedContext.predictedTournamentTeams,
      predictedContext.predictedTournamentMatches,
      predictions.matchPredictions,
      predictions.groupManualTiebreaks,
    );

    const predictionByMatchId = new Map(
      predictions.predictionsScores.map((prediction) => [prediction.match_id, prediction]),
    );

    const predictedMatchById = new Map(
      predictedTournament.bracket.matches.map((match) => [match.match.id, match]),
    );

    // Build a map of match winners from the predicted bracket
    const predictedWinnerByMatchId = new Map<string, string | null>();
    for (const resolvedMatch of predictedTournament.bracket.matches) {
      if (resolvedMatch.team1_id && resolvedMatch.team2_id) {
        predictedWinnerByMatchId.set(resolvedMatch.match.id, resolvedMatch.winner_team_id ?? null);
      }
    }

    // Validate each knockout match prediction
    for (const match of matches.filter((m) => isKnockoutRound(m.round))) {
      matchesChecked++;
      
      const prediction = predictionByMatchId.get(match.id);
      if (!prediction) {
        continue; // No prediction for this match
      }

      const resolvedMatch = predictedMatchById.get(match.id);
      if (!resolvedMatch) {
        continue; // Match not in predicted bracket
      }

      const team1Id = resolvedMatch.team1_id;
      const team2Id = resolvedMatch.team2_id;
      const team1Code = getTeamCode(team1Id, teamById);
      const team2Code = getTeamCode(team2Id, teamById);

      const rawPredictedWinnerId = prediction.predicted_winner_team_id;
      const rawPredictedWinnerCode = getTeamCode(rawPredictedWinnerId, teamById);

      const inferredWinner = inferWinnerFromScore(
        prediction.predicted_team1_score,
        prediction.predicted_team2_score,
      );

      let effectiveWinnerId: string | null = null;
      let effectiveWinnerCode: string | null = null;

      // Determine effective winner
      if (rawPredictedWinnerId) {
        effectiveWinnerId = rawPredictedWinnerId;
        effectiveWinnerCode = rawPredictedWinnerCode;
      } else if (inferredWinner === 'team1' && team1Id) {
        effectiveWinnerId = team1Id;
        effectiveWinnerCode = team1Code;
      } else if (inferredWinner === 'team2' && team2Id) {
        effectiveWinnerId = team2Id;
        effectiveWinnerCode = team2Code;
      }

      // Validate raw predicted winner if present
      if (rawPredictedWinnerId) {
        if (rawPredictedWinnerId !== team1Id && rawPredictedWinnerId !== team2Id) {
          inconsistencies.push({
            email,
            username,
            match_number: match.match_number,
            round: match.round,
            team1_code: team1Code,
            team2_code: team2Code,
            predicted_team1_score: prediction.predicted_team1_score,
            predicted_team2_score: prediction.predicted_team2_score,
            raw_predicted_winner_code: rawPredictedWinnerCode,
            inferred_or_effective_winner_code: effectiveWinnerCode,
            reason: `Raw predicted winner (${rawPredictedWinnerCode}) is not team1 (${team1Code}) or team2 (${team2Code}) of the reconstructed match`,
          });
          invalidWinnersFound++;
        }
      }

      // Validate inferred winner if scores are not tied
      if (inferredWinner && !rawPredictedWinnerId) {
        if (inferredWinner === 'team1' && team1Id) {
          // Valid
        } else if (inferredWinner === 'team2' && team2Id) {
          // Valid
        } else {
          // This shouldn't happen if scores are not tied
          inconsistencies.push({
            email,
            username,
            match_number: match.match_number,
            round: match.round,
            team1_code: team1Code,
            team2_code: team2Code,
            predicted_team1_score: prediction.predicted_team1_score,
            predicted_team2_score: prediction.predicted_team2_score,
            raw_predicted_winner_code: rawPredictedWinnerCode,
            inferred_or_effective_winner_code: effectiveWinnerCode,
            reason: `Inferred winner from score does not match available teams`,
          });
          invalidWinnersFound++;
        }
      }

      // If score is tied, validate that there's an explicit winner
      if (
        prediction.predicted_team1_score !== null &&
        prediction.predicted_team2_score !== null &&
        prediction.predicted_team1_score === prediction.predicted_team2_score &&
        !rawPredictedWinnerId
      ) {
        inconsistencies.push({
          email,
          username,
          match_number: match.match_number,
          round: match.round,
          team1_code: team1Code,
          team2_code: team2Code,
          predicted_team1_score: prediction.predicted_team1_score,
          predicted_team2_score: prediction.predicted_team2_score,
          raw_predicted_winner_code: rawPredictedWinnerCode,
          inferred_or_effective_winner_code: effectiveWinnerCode,
          reason: 'Score is tied but no explicit winner provided',
        });
        invalidWinnersFound++;
      }

      // Validate that the explicit winner (if present) is one of the teams
      if (rawPredictedWinnerId && team1Id && team2Id) {
        if (rawPredictedWinnerId !== team1Id && rawPredictedWinnerId !== team2Id) {
          // Already reported above
        } else if (
          prediction.predicted_team1_score !== null &&
          prediction.predicted_team2_score !== null &&
          prediction.predicted_team1_score !== prediction.predicted_team2_score
        ) {
          // Score is not tied, check if explicit winner matches the score
          const scoreWinner = inferWinnerFromScore(
            prediction.predicted_team1_score,
            prediction.predicted_team2_score,
          );
          const expectedWinnerId = scoreWinner === 'team1' ? team1Id : team2Id;
          if (rawPredictedWinnerId !== expectedWinnerId) {
            inconsistencies.push({
              email,
              username,
              match_number: match.match_number,
              round: match.round,
              team1_code: team1Code,
              team2_code: team2Code,
              predicted_team1_score: prediction.predicted_team1_score,
              predicted_team2_score: prediction.predicted_team2_score,
              raw_predicted_winner_code: rawPredictedWinnerCode,
              inferred_or_effective_winner_code: effectiveWinnerCode,
              reason: `Explicit winner (${rawPredictedWinnerCode}) does not match score winner (${getTeamCode(expectedWinnerId, teamById)})`,
            });
            invalidWinnersFound++;
          }
        }
      }
    }

    // Validate bracket propagation: participants in future rounds should be winners from previous matches
    for (const resolvedMatch of predictedTournament.bracket.matches) {
      const match = matches.find((m) => m.id === resolvedMatch.match.id);
      if (!match) continue;

      const team1Id = resolvedMatch.team1_id;
      const team2Id = resolvedMatch.team2_id;

      // Check team1 slot
      if (team1Id && match.team1_slot) {
        const slotMatchNumber = parseInt(match.team1_slot.replace('W', ''), 10);
        const slotMatch = matches.find((m) => m.match_number === slotMatchNumber);
        if (slotMatch) {
          const slotMatchWinner = predictedWinnerByMatchId.get(slotMatch.id);
          if (slotMatchWinner && slotMatchWinner !== team1Id) {
            inconsistencies.push({
              email,
              username,
              match_number: match.match_number,
              round: match.round,
              team1_code: getTeamCode(team1Id, teamById),
              team2_code: getTeamCode(team2Id, teamById),
              predicted_team1_score: null,
              predicted_team2_score: null,
              raw_predicted_winner_code: null,
              inferred_or_effective_winner_code: getTeamCode(team1Id, teamById),
              reason: `Team1 (${getTeamCode(team1Id, teamById)}) in slot ${match.team1_slot} does not match winner of match ${slotMatchNumber} (${getTeamCode(slotMatchWinner, teamById)})`,
            });
            invalidPropagatedParticipantsFound++;
          }
        }
      }

      // Check team2 slot
      if (team2Id && match.team2_slot) {
        const slotMatchNumber = parseInt(match.team2_slot.replace('W', ''), 10);
        const slotMatch = matches.find((m) => m.match_number === slotMatchNumber);
        if (slotMatch) {
          const slotMatchWinner = predictedWinnerByMatchId.get(slotMatch.id);
          if (slotMatchWinner && slotMatchWinner !== team2Id) {
            inconsistencies.push({
              email,
              username,
              match_number: match.match_number,
              round: match.round,
              team1_code: getTeamCode(team1Id, teamById),
              team2_code: getTeamCode(team2Id, teamById),
              predicted_team1_score: null,
              predicted_team2_score: null,
              raw_predicted_winner_code: null,
              inferred_or_effective_winner_code: getTeamCode(team2Id, teamById),
              reason: `Team2 (${getTeamCode(team2Id, teamById)}) in slot ${match.team2_slot} does not match winner of match ${slotMatchNumber} (${getTeamCode(slotMatchWinner, teamById)})`,
            });
            invalidPropagatedParticipantsFound++;
          }
        }
      }
    }
  }

  console.log(`Visible users audited: ${visibleMembers.length}`);
  console.log(`Matches checked: ${matchesChecked}`);
  console.log(`Invalid winners found: ${invalidWinnersFound}`);
  console.log(`Invalid propagated participants found: ${invalidPropagatedParticipantsFound}`);
  console.log(`Total inconsistencies: ${inconsistencies.length}\n`);

  if (inconsistencies.length > 0) {
    console.table(
      inconsistencies.map((inc) => ({
        email: inc.email,
        username: inc.username,
        match_number: inc.match_number ?? '',
        round: inc.round,
        team1_code: inc.team1_code,
        team2_code: inc.team2_code,
        predicted_team1_score: inc.predicted_team1_score ?? '',
        predicted_team2_score: inc.predicted_team2_score ?? '',
        raw_predicted_winner_code: inc.raw_predicted_winner_code ?? '',
        inferred_or_effective_winner_code: inc.inferred_or_effective_winner_code ?? '',
        reason: inc.reason,
      })),
    );
    console.log('\nBRACKET CONSISTENCY AUDIT FAILED');
    process.exit(1);
  } else {
    console.log('BRACKET CONSISTENCY AUDIT PASSED');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
