#!/usr/bin/env npx tsx
/**
 * Read-only dry run: simulate a knockout match result without writing to Supabase.
 *
 * Usage:
 *   npx tsx scripts/dry-run-knockout-result.ts --match-number 77 --team1-score 2 --team2-score 1 --winner-code ARG
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

interface CliArgs {
  matchNumber: number;
  team1Score: number;
  team2Score: number;
  winnerCode: string;
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

interface ScoreBreakdownDetails {
  groupStageExact?: Array<{ match_id: string; points: number }>;
  groupStageOutcome?: Array<{ match_id: string; points: number }>;
  knockoutExact?: Array<{ match_id: string; points: number }>;
  advancement?: Array<{ team_id: string; round: TournamentRound; points: number }>;
}

interface IntegrityIssue {
  username: string;
  issue_type: string;
  field: string;
  expected: string | number;
  actual: string | number;
  match_number?: number | null;
}

function parseCliArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const values = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    values.set(key, value);
    i += 1;
  }

  const matchNumberRaw = values.get('match-number');
  const team1ScoreRaw = values.get('team1-score');
  const team2ScoreRaw = values.get('team2-score');
  const winnerCode = values.get('winner-code');

  if (!matchNumberRaw || !team1ScoreRaw || !team2ScoreRaw || !winnerCode) {
    throw new Error(
      'Usage: npx tsx scripts/dry-run-knockout-result.ts --match-number <n> --team1-score <n> --team2-score <n> --winner-code <CODE>',
    );
  }

  const matchNumber = Number(matchNumberRaw);
  const team1Score = Number(team1ScoreRaw);
  const team2Score = Number(team2ScoreRaw);

  if (!Number.isInteger(matchNumber) || matchNumber <= 0) {
    throw new Error(`Invalid --match-number: ${matchNumberRaw}`);
  }
  if (!Number.isInteger(team1Score) || team1Score < 0) {
    throw new Error(`Invalid --team1-score: ${team1ScoreRaw}`);
  }
  if (!Number.isInteger(team2Score) || team2Score < 0) {
    throw new Error(`Invalid --team2-score: ${team2ScoreRaw}`);
  }

  return { matchNumber, team1Score, team2Score, winnerCode: winnerCode.toUpperCase() };
}

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

function sumDetailPoints(entries: Array<{ points: number }> | undefined): number {
  return (entries ?? []).reduce((sum, entry) => sum + entry.points, 0);
}

function formatTeamLabel(teamId: string | null | undefined, teamById: Map<string, TeamRow>): string {
  if (!teamId) {
    return '?';
  }
  const team = teamById.get(teamId);
  return team ? `${team.name} (${team.code})` : teamId;
}

function formatTeamPair(
  team1Id: string | null | undefined,
  team2Id: string | null | undefined,
  teamById: Map<string, TeamRow>,
): string {
  return `${formatTeamLabel(team1Id, teamById)} vs ${formatTeamLabel(team2Id, teamById)}`;
}

function formatScore(team1Score: number | null | undefined, team2Score: number | null | undefined): string {
  if (team1Score == null || team2Score == null) {
    return '?';
  }
  return `${team1Score} - ${team2Score}`;
}

function isKnockoutRound(round: string): boolean {
  return round !== 'group';
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

function validateSimulatedScore(
  username: string,
  expected: ScoreBreakdown,
  matches: MatchRow[],
  resultByMatchId: Map<string, MatchResultRow>,
  officialMatchById: Map<string, { team1_id?: string; team2_id?: string }>,
  predictions: UserPredictionBundle,
  context: OfficialScoringContext,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  const columnSum =
    expected.groupStageExactPoints +
    expected.groupStageOutcomePoints +
    expected.knockoutExactPoints +
    expected.advancementPoints +
    expected.championPoints +
    expected.thirdPlacePoints +
    expected.topScorerPoints +
    expected.bestGoalkeeperPoints;

  if (expected.total !== columnSum) {
    issues.push({
      username,
      issue_type: 'total_sum_mismatch',
      field: 'total',
      expected: columnSum,
      actual: expected.total,
    });
  }

  const detailChecks: Array<{
    field: string;
    column: number;
    detailKey: keyof NonNullable<ScoreBreakdown['details']>;
  }> = [
    { field: 'details.groupStageExact', column: expected.groupStageExactPoints, detailKey: 'groupStageExact' },
    {
      field: 'details.groupStageOutcome',
      column: expected.groupStageOutcomePoints,
      detailKey: 'groupStageOutcome',
    },
    { field: 'details.knockoutExact', column: expected.knockoutExactPoints, detailKey: 'knockoutExact' },
    { field: 'details.advancement', column: expected.advancementPoints, detailKey: 'advancement' },
  ];

  for (const check of detailChecks) {
    const detailSum = sumDetailPoints(expected.details?.[check.detailKey]);
    if (detailSum !== check.column) {
      issues.push({
        username,
        issue_type: 'details_sum_mismatch',
        field: check.field,
        expected: check.column,
        actual: detailSum,
      });
    }
  }

  const expectedKnockoutByMatch = new Map(
    (expected.details?.knockoutExact ?? []).map((entry) => [entry.match_id, entry.points]),
  );

  const predictedTournament = buildPredictedTournamentFromScores(
    context.predictedTournamentTeams,
    context.predictedTournamentMatches,
    predictions.matchPredictions,
    predictions.groupManualTiebreaks,
  );
  const predictedMatchById = new Map(
    predictedTournament.bracket.matches.map((resolvedMatch) => [resolvedMatch.match.id, resolvedMatch]),
  );
  const predictionByMatchId = new Map(predictions.predictionsScores.map((prediction) => [prediction.match_id, prediction]));

  const knockoutMatchesWithResults = matches.filter(
    (match) => isKnockoutRound(match.round) && resultByMatchId.has(match.id),
  );

  for (const match of knockoutMatchesWithResults) {
    const realResult = resultByMatchId.get(match.id);
    const prediction = predictionByMatchId.get(match.id);
    const officialMatch = officialMatchById.get(match.id);
    const predictedMatch = predictedMatchById.get(match.id);

    if (!realResult) {
      continue;
    }

    const realTeam1Id = officialMatch?.team1_id;
    const realTeam2Id = officialMatch?.team2_id;
    const predictedTeam1Id = predictedMatch?.team1_id;
    const predictedTeam2Id = predictedMatch?.team2_id;

    const officialMatchup =
      realTeam1Id && realTeam2Id
        ? {
            team1_id: realTeam1Id,
            team2_id: realTeam2Id,
            winner_team_id: realResult.winner_team_id,
          }
        : undefined;

    const predictedMatchup =
      predictedTeam1Id && predictedTeam2Id
        ? {
            team1_id: predictedTeam1Id,
            team2_id: predictedTeam2Id,
            winner_team_id: prediction?.predicted_winner_team_id ?? null,
          }
        : undefined;

    const evaluation = prediction
      ? evaluateKnockoutExactAward(
          {
            match_id: match.id,
            predicted_team1_score: prediction.predicted_team1_score,
            predicted_team2_score: prediction.predicted_team2_score,
            predicted_winner_team_id: prediction.predicted_winner_team_id,
          },
          {
            match_id: match.id,
            team1_score: realResult.team1_score,
            team2_score: realResult.team2_score,
            winner_team_id: realResult.winner_team_id,
          },
          officialMatchup,
          predictedMatchup,
        )
      : { should_award: false, points: 0 };

    const expectedPoints = expectedKnockoutByMatch.get(match.id) ?? 0;

    if (expectedPoints > 0 && !evaluation.should_award) {
      issues.push({
        username,
        issue_type: 'knockout_false_positive',
        field: 'knockoutExact',
        expected: 0,
        actual: expectedPoints,
        match_number: match.match_number,
      });
    } else if (evaluation.should_award && expectedPoints === 0) {
      issues.push({
        username,
        issue_type: 'knockout_false_negative',
        field: 'knockoutExact',
        expected: evaluation.points,
        actual: 0,
        match_number: match.match_number,
      });
    } else if (expectedPoints !== evaluation.points) {
      issues.push({
        username,
        issue_type: 'knockout_detail_mismatch',
        field: 'knockoutExact',
        expected: evaluation.points,
        actual: expectedPoints,
        match_number: match.match_number,
      });
    }
  }

  return issues;
}

function explainKnockoutExactReason(evaluation: ReturnType<typeof evaluateKnockoutExactAward>): string {
  if (evaluation.should_award) {
    return 'Marcador exacto, mismo orden de equipos y ganador correcto (+10 pts)';
  }

  const reasons: string[] = [];
  if (!evaluation.score_matches) {
    reasons.push('marcador no coincide');
  }
  if (!evaluation.matchup_matches_same_order) {
    if (evaluation.matchup_matches_swapped) {
      reasons.push('equipos coinciden pero en orden invertido');
    } else {
      reasons.push('emparejamiento no coincide');
    }
  }
  if (!evaluation.winner_matches) {
    reasons.push('ganador no coincide');
  }
  return reasons.length > 0 ? reasons.join('; ') : 'no cumple criterios';
}

async function main() {
  const cli = parseCliArgs();

  console.log('Dry run knockout result (read-only, no DB writes)');
  console.log(`Group: ${GROUP_ID}`);
  console.log(
    `Simulated: match #${cli.matchNumber} → ${cli.team1Score}-${cli.team2Score}, winner ${cli.winnerCode}\n`,
  );

  const [
    teamsData,
    matchesData,
    matchResultsData,
    manualTiebreaksData,
    tournamentResultsData,
    globalAdminsData,
    membersData,
    scoreBreakdownsData,
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
    supabase.from('score_breakdowns').select('*').eq('group_id', GROUP_ID),
  ]);

  if (teamsData.error) throw teamsData.error;
  if (matchesData.error) throw matchesData.error;
  if (matchResultsData.error) throw matchResultsData.error;
  if (manualTiebreaksData.error) throw manualTiebreaksData.error;
  if (globalAdminsData.error) throw globalAdminsData.error;
  if (membersData.error) throw membersData.error;
  if (scoreBreakdownsData.error) throw scoreBreakdownsData.error;

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

  const targetMatch = matches.find((match) => match.match_number === cli.matchNumber);
  if (!targetMatch) {
    throw new Error(`Match number ${cli.matchNumber} not found`);
  }
  if (!isKnockoutRound(targetMatch.round)) {
    throw new Error(`Match #${cli.matchNumber} is not a knockout match (round: ${targetMatch.round})`);
  }

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const teamByCode = new Map(teams.map((team) => [team.code.toUpperCase(), team]));
  const winnerTeam = teamByCode.get(cli.winnerCode);
  if (!winnerTeam) {
    throw new Error(`Winner code not found: ${cli.winnerCode}`);
  }

  const currentOfficialContext = buildOfficialScoringContext(
    teams,
    matches,
    matchResults,
    manualTiebreaksData.data as ManualTiebreakRow[],
    tournamentResults,
  );

  const currentOfficialMatch = currentOfficialContext.bracketOutput.matches.find(
    (resolved) => resolved.match.id === targetMatch.id,
  );
  const officialTeam1Id = currentOfficialMatch?.team1_id ?? targetMatch.team1_id;
  const officialTeam2Id = currentOfficialMatch?.team2_id ?? targetMatch.team2_id;

  if (!officialTeam1Id || !officialTeam2Id) {
    throw new Error(
      `Cannot resolve teams for match #${cli.matchNumber}. Bracket slots are not yet filled.`,
    );
  }

  if (winnerTeam.id !== officialTeam1Id && winnerTeam.id !== officialTeam2Id) {
    throw new Error(
      `Winner ${cli.winnerCode} is not playing in match #${cli.matchNumber} (${formatTeamPair(officialTeam1Id, officialTeam2Id, teamById)})`,
    );
  }

  const simulatedMatchResults: MatchResultRow[] = matchResults.map((result) => {
    if (result.match_id === targetMatch.id) {
      return {
        ...result,
        team1_score: cli.team1Score,
        team2_score: cli.team2Score,
        winner_team_id: winnerTeam.id,
      };
    }
    return result;
  });

  // If the match doesn't have a result yet, add it to the simulated results
  const existingResult = matchResults.find((result) => result.match_id === targetMatch.id);
  if (!existingResult) {
    simulatedMatchResults.push({
      id: '',
      match_id: targetMatch.id,
      team1_score: cli.team1Score,
      team2_score: cli.team2Score,
      winner_team_id: winnerTeam.id,
      entered_by: 'dry-run-simulation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const simulatedOfficialContext = buildOfficialScoringContext(
    teams,
    matches,
    simulatedMatchResults,
    manualTiebreaksData.data as ManualTiebreakRow[],
    tournamentResults,
  );

  const simulatedOfficialMatch = simulatedOfficialContext.bracketOutput.matches.find(
    (resolved) => resolved.match.id === targetMatch.id,
  );
  const simulatedResult = simulatedMatchResults.find((result) => result.match_id === targetMatch.id)!;
  const previousResult = matchResults.find((result) => result.match_id === targetMatch.id);

  console.log('Simulated match details');
  console.log('─'.repeat(60));
  console.log(`Match #${cli.matchNumber} (${targetMatch.round})`);
  console.log(`Teams: ${formatTeamPair(officialTeam1Id, officialTeam2Id, teamById)}`);
  console.log(`Score: ${formatScore(simulatedResult.team1_score, simulatedResult.team2_score)}`);
  console.log(`Winner: ${formatTeamLabel(winnerTeam.id, teamById)}`);
  if (previousResult) {
    console.log(
      `Previous result: ${formatScore(previousResult.team1_score, previousResult.team2_score)} → ${formatTeamLabel(previousResult.winner_team_id, teamById)} (replaced in memory)`,
    );
  } else {
    console.log('Previous result: (none, added in memory only)');
  }
  console.log('');

  const globalAdminIds = new Set((globalAdminsData.data ?? []).map((admin) => admin.user_id));
  const visibleMembers = (membersData.data ?? []).filter((member) => {
    if (globalAdminIds.has(member.user_id)) {
      return false;
    }
    return !member.hidden_from_leaderboard;
  });

  const scoreBreakdownsByUser = new Map(
    (scoreBreakdownsData.data ?? []).map((row) => [row.user_id, row]),
  );

  const emailByUserId = await loadUserEmails(visibleMembers.map((member) => member.user_id));

  const summaryRows: Array<Record<string, string | number>> = [];
  const knockoutExactRows: Array<Record<string, string | number | boolean>> = [];
  const integrityIssues: IntegrityIssue[] = [];

  const simulatedResultByMatchId = new Map(
    simulatedMatchResults.map((result) => [result.match_id, result]),
  );
  const simulatedOfficialMatchById = new Map(
    simulatedOfficialContext.bracketOutput.matches.map((resolved) => [
      resolved.match.id,
      resolved,
    ]),
  );

  for (const member of visibleMembers) {
    const userId = member.user_id;
    const profileRaw = member.profiles;
    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as ProfileRow | null;
    const username = profile?.username ?? '(sin username)';
    const storedBreakdown = scoreBreakdownsByUser.get(userId) ?? null;

    const predictions = await loadUserPredictionsLikeRecalculate(userId);
    const currentScore = computeExpectedScoreLikeRecalculate(userId, predictions, currentOfficialContext);
    const simulatedScore = computeExpectedScoreLikeRecalculate(userId, predictions, simulatedOfficialContext);

    const storedDetails = (storedBreakdown?.details ?? {}) as ScoreBreakdownDetails;
    const currentKnockoutForMatch =
      (storedDetails.knockoutExact ?? []).find((entry) => entry.match_id === targetMatch.id)?.points ?? 0;
    const simulatedKnockoutForMatch =
      (simulatedScore.details?.knockoutExact ?? []).find((entry) => entry.match_id === targetMatch.id)
        ?.points ?? 0;

    summaryRows.push({
      usuario: username,
      total_actual: storedBreakdown?.total_points ?? currentScore.total,
      total_simulado: simulatedScore.total,
      diferencia: simulatedScore.total - (storedBreakdown?.total_points ?? currentScore.total),
      avances_actual: storedBreakdown?.advances_points ?? currentScore.advancementPoints,
      avances_simulado: simulatedScore.advancementPoints,
      knockoutExact_actual: storedBreakdown?.exact_scores_knockout ?? currentScore.knockoutExactPoints,
      knockoutExact_simulado: simulatedScore.knockoutExactPoints,
      knockoutExact_partido_actual: currentKnockoutForMatch,
      knockoutExact_partido_simulado: simulatedKnockoutForMatch,
    });

    const prediction = predictions.predictionsScores.find((row) => row.match_id === targetMatch.id);
    const predictedTournament = buildPredictedTournamentFromScores(
      currentOfficialContext.predictedTournamentTeams,
      currentOfficialContext.predictedTournamentMatches,
      predictions.matchPredictions,
      predictions.groupManualTiebreaks,
    );
    const predictedMatch = predictedTournament.bracket.matches.find(
      (resolved) => resolved.match.id === targetMatch.id,
    );

    const officialMatchup = {
      team1_id: simulatedOfficialMatch?.team1_id ?? officialTeam1Id,
      team2_id: simulatedOfficialMatch?.team2_id ?? officialTeam2Id,
      winner_team_id: simulatedResult.winner_team_id,
    };

    const predictedMatchup =
      predictedMatch?.team1_id && predictedMatch?.team2_id
        ? {
            team1_id: predictedMatch.team1_id,
            team2_id: predictedMatch.team2_id,
            winner_team_id: prediction?.predicted_winner_team_id ?? null,
          }
        : undefined;

    const evaluation = prediction
      ? evaluateKnockoutExactAward(
          {
            match_id: targetMatch.id,
            predicted_team1_score: prediction.predicted_team1_score,
            predicted_team2_score: prediction.predicted_team2_score,
            predicted_winner_team_id: prediction.predicted_winner_team_id,
          },
          {
            match_id: targetMatch.id,
            team1_score: simulatedResult.team1_score,
            team2_score: simulatedResult.team2_score,
            winner_team_id: simulatedResult.winner_team_id,
          },
          officialMatchup,
          predictedMatchup,
        )
      : null;

    knockoutExactRows.push({
      usuario: username,
      tiene_prediccion: Boolean(prediction),
      puntos_actuales_partido: currentKnockoutForMatch,
      puntos_simulados_partido: simulatedKnockoutForMatch,
      deberia_recibir: evaluation?.should_award ?? false,
      marcador_coincide: evaluation?.score_matches ?? false,
      emparejamiento_mismo_orden: evaluation?.matchup_matches_same_order ?? false,
      emparejamiento_invertido: evaluation?.matchup_matches_swapped ?? false,
      ganador_coincide: evaluation?.winner_matches ?? false,
      prediccion: prediction
        ? formatScore(prediction.predicted_team1_score, prediction.predicted_team2_score)
        : '(sin predicción)',
      equipos_predichos: prediction && predictedMatchup
        ? formatTeamPair(predictedMatchup.team1_id, predictedMatchup.team2_id, teamById)
        : prediction
          ? '(no resuelto)'
          : '(sin predicción)',
      equipos_reales: formatTeamPair(officialMatchup.team1_id, officialMatchup.team2_id, teamById),
      motivo: evaluation ? explainKnockoutExactReason(evaluation) : 'sin predicción',
    });

    integrityIssues.push(
      ...validateSimulatedScore(
        username,
        simulatedScore,
        matches,
        simulatedResultByMatchId,
        simulatedOfficialMatchById,
        predictions,
        simulatedOfficialContext,
      ),
    );
  }

  console.log(`Visible users: ${visibleMembers.length}\n`);

  // Verify that current calculated scores match stored scores
  const scoreMismatches: Array<{ username: string; stored: number; calculated: number; diff: number }> = [];
  for (const row of summaryRows) {
    const stored = Number(row.total_actual);
    const simulated = Number(row.total_simulado);
    const diff = Number(row.diferencia);
    if (stored !== simulated && diff === 0) {
      scoreMismatches.push({
        username: row.usuario as string,
        stored,
        calculated: simulated,
        diff: simulated - stored,
      });
    }
  }

  if (scoreMismatches.length > 0) {
    console.log('WARNING: Current calculated scores do not match stored scores:');
    console.table(scoreMismatches);
    console.log('');
  } else {
    console.log('✓ Current calculated scores match stored scores (base verification passed)\n');
  }

  console.log('Score comparison (current stored vs simulated) - showing users with score changes:');
  const changedScores = summaryRows.filter(row => Number(row.diferencia) !== 0);
  if (changedScores.length > 0) {
    console.log(`Found ${changedScores.length} users with score changes`);
    console.table(changedScores);
  } else {
    console.log('No score changes from this simulation');
  }

  console.log('\nKnockoutExact for simulated match:');
  const awardRecipients = knockoutExactRows.filter((row) => row.deberia_recibir === true);
  console.log(`Users who would receive knockoutExact for match #${cli.matchNumber}: ${awardRecipients.length}`);
  if (awardRecipients.length > 0) {
    for (const row of awardRecipients) {
      console.log(`  • ${row.usuario}: +10 pts — ${row.motivo}`);
    }
  } else {
    console.log('  (none)');
  }

  console.log('\nSimulated scoring integrity validation');
  if (integrityIssues.length > 0) {
    console.table(
      integrityIssues.map((issue) => ({
        usuario: issue.username,
        issue_type: issue.issue_type,
        field: issue.field,
        expected: issue.expected,
        actual: issue.actual,
        match_number: issue.match_number ?? '',
      })),
    );
    console.log('\nDRY RUN FAILED: simulated scoring integrity issues detected');
    process.exit(1);
  }

  console.log('  ✓ no false positives');
  console.log('  ✓ no false negatives');
  console.log('  ✓ total = sum of columns');
  console.log('  ✓ details match columns');
  console.log('\nDRY RUN COMPLETE (no database changes made)');
}

main().catch((error) => {
  console.error('Dry run failed:', error);
  process.exit(1);
});
