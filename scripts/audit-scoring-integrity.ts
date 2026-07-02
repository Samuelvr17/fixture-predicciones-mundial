#!/usr/bin/env npx tsx
/**
 * Read-only audit: scoring integrity for the global group.
 *
 * Recalculates expected scores in memory using the same logic as
 * recalculateGroupScores (src/server/scoring/recalculateScores.ts) and
 * compares against stored score_breakdowns.
 *
 * Usage:
 *   npx tsx scripts/audit-scoring-integrity.ts
 *   npx tsx scripts/audit-scoring-integrity.ts --debug-user bienestarydeporte@gmail.com
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import ws from 'ws';
import {
  calculateScore,
  evaluateKnockoutExactAward,
  type KnockoutMatchup,
  type Match,
  type MatchPrediction,
  type MatchResult,
  type PredictionAdvance,
  type PredictionSpecial,
  type ResolvedBracket,
  type ScoreBreakdown,
  type TournamentRound,
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
import { GLOBAL_GROUP_ID } from '../src/lib/groups/globalGroup';

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

const GROUP_ID = GLOBAL_GROUP_ID;
const DEBUG_USER_EMAIL = process.argv
  .find((arg) => arg.startsWith('--debug-user='))
  ?.split('=')[1]
  ?? (process.argv.includes('--debug-user')
    ? process.argv[process.argv.indexOf('--debug-user') + 1]
    : undefined);

type TeamRow = Database['public']['Tables']['teams']['Row'];
type MatchRow = Database['public']['Tables']['matches']['Row'];
type MatchResultRow = Database['public']['Tables']['match_results']['Row'];
type PredictionScoreRow = Database['public']['Tables']['predictions_scores']['Row'];
type PredictionAdvanceRow = Database['public']['Tables']['predictions_advances']['Row'];
type PredictionSpecialRow = Database['public']['Tables']['predictions_specials']['Row'];
type PredictionManualTiebreakRow =
  Database['public']['Tables']['prediction_manual_tiebreaks']['Row'];
type ScoreBreakdownRow = Database['public']['Tables']['score_breakdowns']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ManualTiebreakRow = Database['public']['Tables']['manual_tiebreaks']['Row'];
type TournamentResultsRow = Database['public']['Tables']['tournament_results']['Row'];

interface ScoreBreakdownDetails {
  groupStageExact?: Array<{ match_id: string; points: number }>;
  groupStageOutcome?: Array<{ match_id: string; points: number }>;
  knockoutExact?: Array<{ match_id: string; points: number }>;
  advancement?: Array<{ team_id: string; round: TournamentRound; points: number }>;
}

interface DiffRow {
  email: string;
  username: string;
  issue_type: string;
  field: string;
  expected: string | number;
  stored: string | number;
  match_id?: string;
  match_number?: number | null;
}

interface OfficialScoringContext {
  resolvedBracket: ResolvedBracket;
  scoringMatches: Match[];
  scoringMatchResults: MatchResult[];
  officialKnockoutMatchups: Map<string, KnockoutMatchup>;
  predictedTournamentTeams: PredictedTournamentTeam[];
  predictedTournamentMatches: PredictedTournamentMatch[];
  teamAdvances: Record<string, TournamentRound>;
  bracketOutput: BracketOutput;
}

interface UserPredictionBundle {
  matchPredictions: MatchPrediction[];
  predictionAdvances: PredictionAdvance[];
  predictionSpecials: PredictionSpecial;
  groupManualTiebreaks: GroupTiebreak[];
  predictionsScores: PredictionScoreRow[];
}

const COLUMN_MAP = {
  total_points: 'total',
  exact_scores_group_stage: 'groupStageExactPoints',
  correct_results_group_stage: 'groupStageOutcomePoints',
  exact_scores_knockout: 'knockoutExactPoints',
  advances_points: 'advancementPoints',
  champion_points: 'championPoints',
  third_place_points: 'thirdPlacePoints',
  top_scorer_points: 'topScorerPoints',
  best_goalkeeper_points: 'bestGoalkeeperPoints',
} as const;

// ============================================================================
// Helpers mirrored from src/server/scoring/recalculateScores.ts
// ============================================================================

function dbMatchToScoringMatch(dbMatch: MatchRow): Match {
  return {
    id: dbMatch.id,
    round: dbMatch.round,
    team1_id: dbMatch.team1_id,
    team2_id: dbMatch.team2_id,
  };
}

function dbMatchResultToScoringMatchResult(dbResult: MatchResultRow): MatchResult {
  return {
    match_id: dbResult.match_id,
    team1_score: dbResult.team1_score,
    team2_score: dbResult.team2_score,
    winner_team_id: dbResult.winner_team_id,
  };
}

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

function buildOfficialScoringContext(
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
): OfficialScoringContext {
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

  const teamAdvances = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

  const resolvedBracket: ResolvedBracket = {
    champion_team_id: bracketOutput.champion || tournamentResults.champion_team_id,
    third_place_team_id: bracketOutput.thirdPlace || tournamentResults.third_place_team_id,
    official_top_scorer: tournamentResults.top_scorer_name,
    official_top_scorer_candidate_id: tournamentResults.top_scorer_candidate_id,
    official_best_goalkeeper_candidate_id: tournamentResults.best_goalkeeper_candidate_id,
    official_best_goalkeeper: tournamentResults.best_goalkeeper_name,
    team_advances: teamAdvances,
  };

  return {
    resolvedBracket,
    scoringMatches: matches.map(dbMatchToScoringMatch),
    scoringMatchResults: matchResults.map(dbMatchResultToScoringMatchResult),
    officialKnockoutMatchups: buildKnockoutMatchupMap(bracketOutput.matches),
    predictedTournamentTeams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      code: team.code,
      group_code: team.group_code,
    })),
    predictedTournamentMatches: matches.map(dbMatchToPredictedTournamentMatch),
    teamAdvances,
    bracketOutput,
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

function computeExpectedScoreLikeRecalculate(
  userId: string,
  predictions: UserPredictionBundle,
  context: OfficialScoringContext,
): ScoreBreakdown {
  const predictedTournament = buildPredictedTournamentFromScores(
    context.predictedTournamentTeams,
    context.predictedTournamentMatches,
    predictions.matchPredictions,
    predictions.groupManualTiebreaks,
  );
  const predictedKnockoutMatchups = buildKnockoutMatchupMap(predictedTournament.bracket.matches);

  return calculateScore({
    group_id: GROUP_ID,
    user_id: userId,
    match_predictions: predictions.matchPredictions,
    predicted_team_advances: predictedTournament.teamAdvances,
    predicted_champion_team_id: predictedTournament.championTeamId,
    predicted_third_place_team_id: predictedTournament.thirdPlaceTeamId,
    predictions_advances: predictions.predictionAdvances,
    predictions_specials: predictions.predictionSpecials,
    matches: context.scoringMatches,
    match_results: context.scoringMatchResults,
    resolvedBracket: context.resolvedBracket,
    official_knockout_matchups: context.officialKnockoutMatchups,
    predicted_knockout_matchups: predictedKnockoutMatchups,
  });
}

function sumDetailPoints(entries: Array<{ points: number }> | undefined): number {
  return (entries ?? []).reduce((sum, entry) => sum + entry.points, 0);
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

function formatMatchup(
  matchup: KnockoutMatchup | undefined,
  teamById: Map<string, TeamRow>,
): string {
  if (!matchup) {
    return '(undefined)';
  }
  const team1 = teamById.get(matchup.team1_id);
  const team2 = teamById.get(matchup.team2_id);
  return `${team1?.code ?? matchup.team1_id} vs ${team2?.code ?? matchup.team2_id}`;
}

function printDebugUserReport(args: {
  email: string;
  userId: string;
  predictions: UserPredictionBundle;
  expected: ScoreBreakdown;
  storedBreakdown: ScoreBreakdownRow | null;
  context: OfficialScoringContext;
  matchResults: MatchResultRow[];
  matches: MatchRow[];
  teams: TeamRow[];
}) {
  const {
    email,
    userId,
    predictions,
    expected,
    storedBreakdown,
    context,
    matchResults,
    matches,
    teams,
  } = args;

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const resultByMatchId = new Map(matchResults.map((result) => [result.match_id, result]));
  const predictionByMatchId = new Map(
    predictions.predictionsScores.map((prediction) => [prediction.match_id, prediction]),
  );
  const groupMatchIds = new Set(
    matches.filter((match) => match.round === 'group').map((match) => match.id),
  );

  const groupMatchesWithPredictionAndResult = [...groupMatchIds].filter(
    (matchId) => resultByMatchId.has(matchId) && predictionByMatchId.has(matchId),
  ).length;

  const predictedTournament = buildPredictedTournamentFromScores(
    context.predictedTournamentTeams,
    context.predictedTournamentMatches,
    predictions.matchPredictions,
    predictions.groupManualTiebreaks,
  );
  const predictedKnockoutMatchups = buildKnockoutMatchupMap(predictedTournament.bracket.matches);

  const match76 = matches.find((match) => match.match_number === 76);
  const officialMatchup76 = match76 ? context.officialKnockoutMatchups.get(match76.id) : undefined;
  const predictedMatchup76 = match76 ? predictedKnockoutMatchups.get(match76.id) : undefined;
  const prediction76 = match76 ? predictionByMatchId.get(match76.id) : undefined;
  const result76 = match76 ? resultByMatchId.get(match76.id) : undefined;

  const knockoutEval76 =
    match76 && prediction76 && result76
      ? evaluateKnockoutExactAward(
          dbPredictionToMatchPrediction(prediction76),
          dbMatchResultToScoringMatchResult(result76),
          officialMatchup76,
          predictedMatchup76,
        )
      : null;

  const debugTeamCodes = ['BRA', 'CAN', 'JPN'] as const;
  const officialAdvancesForTeams = Object.fromEntries(
    debugTeamCodes.map((code) => {
      const team = teams.find((entry) => entry.code === code);
      return [code, team ? context.teamAdvances[team.id] ?? '(missing)' : '(team not found)'];
    }),
  );
  const predictedAdvancesForTeams = Object.fromEntries(
    debugTeamCodes.map((code) => {
      const team = teams.find((entry) => entry.code === code);
      return [
        code,
        team ? predictedTournament.teamAdvances[team.id] ?? '(missing)' : '(team not found)',
      ];
    }),
  );

  console.log(`\n=== DEBUG USER: ${email} (${userId}) ===`);
  console.log(`predictions_scores loaded: ${predictions.predictionsScores.length}`);
  console.log(`match_results loaded (global): ${matchResults.length}`);
  console.log(
    `group matches with prediction and result: ${groupMatchesWithPredictionAndResult}`,
  );
  console.log(
    `groupStageExact expected=${expected.groupStageExactPoints} stored=${storedBreakdown?.exact_scores_group_stage ?? '(missing)'}`,
  );
  console.log(
    `groupStageOutcome expected=${expected.groupStageOutcomePoints} stored=${storedBreakdown?.correct_results_group_stage ?? '(missing)'}`,
  );
  console.log(`official matchup #76: ${formatMatchup(officialMatchup76, teamById)}`);
  console.log(`predicted matchup #76: ${formatMatchup(predictedMatchup76, teamById)}`);
  console.log(
  `knockoutExact #76 evaluation: ${knockoutEval76 ? JSON.stringify(knockoutEval76, null, 2) : '(no prediction/result)'}`,
  );
  console.log(`official teamAdvances BRA/CAN/JPN: ${JSON.stringify(officialAdvancesForTeams)}`);
  console.log(
    `predicted teamAdvances BRA/CAN/JPN: ${JSON.stringify(predictedAdvancesForTeams)}`,
  );
  console.log('=== END DEBUG USER ===\n');
}

async function main() {
  console.log('Scoring integrity audit (read-only)');
  console.log(`Group: ${GROUP_ID}`);
  if (DEBUG_USER_EMAIL) {
    console.log(`Debug user: ${DEBUG_USER_EMAIL}`);
  }
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

  const officialContext = buildOfficialScoringContext(
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

  const resultByMatchId = new Map(matchResults.map((result) => [result.match_id, result]));
  const knockoutMatchesWithResults = matches.filter(
    (match) => isKnockoutRound(match.round) && resultByMatchId.has(match.id),
  );

  const emailByUserId = await loadUserEmails(visibleMembers.map((member) => member.user_id));
  const diffs: DiffRow[] = [];
  let debugUserHandled = false;

  for (const member of visibleMembers) {
    const userId = member.user_id;
    const profileRaw = member.profiles;
    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as ProfileRow | null;
    const username = profile?.username ?? '(sin username)';
    const email = emailByUserId.get(userId) ?? '(sin email)';

    const predictions = await loadUserPredictionsLikeRecalculate(userId);
    const expected = computeExpectedScoreLikeRecalculate(userId, predictions, officialContext);

    const { data: storedBreakdown, error: storedBreakdownError } = await supabase
      .from('score_breakdowns')
      .select('*')
      .eq('group_id', GROUP_ID)
      .eq('user_id', userId)
      .maybeSingle();

    if (storedBreakdownError) throw storedBreakdownError;

    const shouldDebugUser =
      DEBUG_USER_EMAIL != null &&
      email.toLowerCase() === DEBUG_USER_EMAIL.toLowerCase();

    if (shouldDebugUser) {
      debugUserHandled = true;
      printDebugUserReport({
        email,
        userId,
        predictions,
        expected,
        storedBreakdown,
        context: officialContext,
        matchResults,
        matches,
        teams,
      });
    }

    if (!storedBreakdown) {
      diffs.push({
        email,
        username,
        issue_type: 'missing_breakdown',
        field: 'score_breakdowns',
        expected: expected.total,
        stored: '(missing)',
      });
      continue;
    }

    for (const [dbColumn, expectedKey] of Object.entries(COLUMN_MAP)) {
      const storedValue = storedBreakdown[dbColumn as keyof typeof COLUMN_MAP];
      const expectedValue = expected[expectedKey as keyof typeof expected];
      if (storedValue !== expectedValue) {
        diffs.push({
          email,
          username,
          issue_type: 'column_mismatch',
          field: dbColumn,
          expected: expectedValue as number,
          stored: storedValue as number,
        });
      }
    }

    const storedColumnSum =
      storedBreakdown.exact_scores_group_stage +
      storedBreakdown.correct_results_group_stage +
      storedBreakdown.exact_scores_knockout +
      storedBreakdown.advances_points +
      storedBreakdown.champion_points +
      storedBreakdown.third_place_points +
      storedBreakdown.top_scorer_points +
      storedBreakdown.best_goalkeeper_points;

    if (storedBreakdown.total_points !== storedColumnSum) {
      diffs.push({
        email,
        username,
        issue_type: 'stored_total_sum_mismatch',
        field: 'total_points',
        expected: storedColumnSum,
        stored: storedBreakdown.total_points,
      });
    }

    const storedDetails = (storedBreakdown.details ?? {}) as ScoreBreakdownDetails;

    const detailChecks: Array<{
      field: string;
      storedColumn: keyof ScoreBreakdownRow;
      detailKey: keyof ScoreBreakdownDetails;
    }> = [
      {
        field: 'details.groupStageExact',
        storedColumn: 'exact_scores_group_stage',
        detailKey: 'groupStageExact',
      },
      {
        field: 'details.groupStageOutcome',
        storedColumn: 'correct_results_group_stage',
        detailKey: 'groupStageOutcome',
      },
      {
        field: 'details.knockoutExact',
        storedColumn: 'exact_scores_knockout',
        detailKey: 'knockoutExact',
      },
      {
        field: 'details.advancement',
        storedColumn: 'advances_points',
        detailKey: 'advancement',
      },
    ];

    for (const check of detailChecks) {
      const detailSum = sumDetailPoints(storedDetails[check.detailKey]);
      const storedColumnValue = storedBreakdown[check.storedColumn] as number;
      if (detailSum !== storedColumnValue) {
        diffs.push({
          email,
          username,
          issue_type: 'stored_details_sum_mismatch',
          field: check.field,
          expected: storedColumnValue,
          stored: detailSum,
        });
      }
    }

    const expectedKnockoutByMatch = new Map(
      (expected.details?.knockoutExact ?? []).map((entry) => [entry.match_id, entry.points]),
    );
    const storedKnockoutByMatch = new Map(
      (storedDetails.knockoutExact ?? []).map((entry) => [entry.match_id, entry.points]),
    );

    const predictedTournament = buildPredictedTournamentFromScores(
      officialContext.predictedTournamentTeams,
      officialContext.predictedTournamentMatches,
      predictions.matchPredictions,
      predictions.groupManualTiebreaks,
    );
    const predictedKnockoutMatchups = buildKnockoutMatchupMap(predictedTournament.bracket.matches);
    const predictionByMatchId = new Map(
      predictions.predictionsScores.map((prediction) => [prediction.match_id, prediction]),
    );

    for (const match of knockoutMatchesWithResults) {
      const realResult = resultByMatchId.get(match.id);
      const prediction = predictionByMatchId.get(match.id);
      const officialMatchup = officialContext.officialKnockoutMatchups.get(match.id);
      const predictedMatchup = predictedKnockoutMatchups.get(match.id);

      if (!realResult) {
        continue;
      }

      const evaluation = prediction
        ? evaluateKnockoutExactAward(
            dbPredictionToMatchPrediction(prediction),
            dbMatchResultToScoringMatchResult(realResult),
            officialMatchup,
            predictedMatchup,
          )
        : {
            should_award: false,
            points: 0,
          };

      const expectedPoints = expectedKnockoutByMatch.get(match.id) ?? 0;
      const storedPoints = storedKnockoutByMatch.get(match.id) ?? 0;

      if (storedPoints > 0 && !evaluation.should_award) {
        diffs.push({
          email,
          username,
          issue_type: 'knockout_false_positive',
          field: 'knockoutExact',
          expected: 0,
          stored: storedPoints,
          match_id: match.id,
          match_number: match.match_number,
        });
      } else if (evaluation.should_award && storedPoints === 0) {
        diffs.push({
          email,
          username,
          issue_type: 'knockout_false_negative',
          field: 'knockoutExact',
          expected: evaluation.points,
          stored: 0,
          match_id: match.id,
          match_number: match.match_number,
        });
      } else if (expectedPoints !== storedPoints) {
        diffs.push({
          email,
          username,
          issue_type: 'knockout_detail_mismatch',
          field: 'knockoutExact',
          expected: expectedPoints,
          stored: storedPoints,
          match_id: match.id,
          match_number: match.match_number,
        });
      }
    }
  }

  if (DEBUG_USER_EMAIL && !debugUserHandled) {
    console.warn(`Debug user not found among visible members: ${DEBUG_USER_EMAIL}`);
  }

  console.log(`Visible users audited: ${visibleMembers.length}`);
  console.log(`Differences found: ${diffs.length}\n`);

  if (diffs.length > 0) {
    console.table(
      diffs.map((diff) => ({
        email: diff.email,
        username: diff.username,
        issue_type: diff.issue_type,
        field: diff.field,
        expected: diff.expected,
        stored: diff.stored,
        match_number: diff.match_number ?? '',
        match_id: diff.match_id ?? '',
      })),
    );
    console.log('\nSCORING AUDIT FAILED');
    process.exit(1);
  }

  console.log('SCORING AUDIT PASSED');
}

main().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
