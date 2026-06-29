#!/usr/bin/env npx tsx
/**
 * Read-only audit: knockoutExact false positives and false negatives.
 *
 * Usage:
 *   npx tsx scripts/audit-knockout-exact-matchups.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import ws from 'ws';
import { buildPredictedTournamentFromScores } from '../src/lib/tournament/predictedTournament';
import { calculateGroupStandings } from '../src/lib/tournament/groupStandings';
import { calculateBestThirds, type ManualTiebreak as BestThirdsTiebreak } from '../src/lib/tournament/bestThirds';
import { resolveBracket } from '../src/lib/tournament/bracket';
import { evaluateKnockoutExactAward, inferKnockoutWinner } from '../src/lib/scoring/scoring';
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
type PredictionManualTiebreakRow =
  Database['public']['Tables']['prediction_manual_tiebreaks']['Row'];
type ScoreBreakdownRow = Database['public']['Tables']['score_breakdowns']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface KnockoutExactDetail {
  match_id: string;
  points: number;
}

interface ScoreBreakdownDetails {
  knockoutExact?: KnockoutExactDetail[];
}

type IssueType = 'false_positive' | 'false_negative' | 'ok';

interface AuditRow {
  email: string;
  username: string;
  match_id: string;
  match_number: number | null;
  round: string;
  real_teams: string;
  predicted_teams: string;
  real_score: string;
  predicted_score: string;
  real_winner: string;
  predicted_winner_raw: string;
  predicted_winner_inferred: string;
  matchup_matches_same_order: boolean;
  matchup_matches_swapped: boolean;
  score_matches: boolean;
  winner_matches: boolean;
  currently_awarded: number;
  should_award: boolean;
  issue_type: IssueType;
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

function teamPairIncludesCodes(
  team1Id: string | null | undefined,
  team2Id: string | null | undefined,
  teamById: Map<string, TeamRow>,
  codes: string[],
): boolean {
  const wanted = new Set(codes.map((code) => code.toUpperCase()));
  const team1Code = team1Id ? teamById.get(team1Id)?.code?.toUpperCase() : undefined;
  const team2Code = team2Id ? teamById.get(team2Id)?.code?.toUpperCase() : undefined;
  return wanted.has(team1Code ?? '') && wanted.has(team2Code ?? '');
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

function toAuditTableRow(row: AuditRow): Record<string, string | number | boolean> {
  return {
    email: row.email,
    username: row.username,
    match_number: row.match_number ?? '?',
    round: row.round,
    real_teams: row.real_teams,
    predicted_teams: row.predicted_teams,
    real_score: row.real_score,
    predicted_score: row.predicted_score,
    real_winner: row.real_winner,
    predicted_winner_raw: row.predicted_winner_raw,
    predicted_winner_inferred: row.predicted_winner_inferred,
    matchup_matches_same_order: row.matchup_matches_same_order,
    matchup_matches_swapped: row.matchup_matches_swapped,
    score_matches: row.score_matches,
    winner_matches: row.winner_matches,
    currently_awarded: row.currently_awarded,
    should_award: row.should_award,
    issue_type: row.issue_type,
  };
}

async function main() {
  console.log('Audit knockoutExact matchups (read-only)');
  console.log(`Group: ${GROUP_ID}\n`);

  const [teamsData, matchesData, matchResultsData, manualTiebreaksData, globalAdminsData, membersData] =
    await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('match_results').select('*'),
      supabase.from('manual_tiebreaks').select('*'),
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
  const globalAdminIds = new Set((globalAdminsData.data ?? []).map((admin) => admin.user_id));

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const resultByMatchId = new Map(matchResults.map((result) => [result.match_id, result]));

  const knockoutMatchesWithResults = matches.filter(
    (match) => isKnockoutRound(match.round) && resultByMatchId.has(match.id),
  );

  const groupTiebreaks = manualTiebreaksData.data
    .filter((tiebreak) => tiebreak.type === 'group_tiebreak')
    .map((tiebreak) => ({
      type: 'group' as const,
      reference: tiebreak.reference,
      ordered_team_ids: tiebreak.ordered_team_ids,
    }));

  const bestThirdsTiebreak = manualTiebreaksData.data.find(
    (tiebreak) => tiebreak.type === 'best_thirds',
  ) as BestThirdsTiebreak | undefined;

  const tournamentTeams = teams.map((team) => ({
    id: team.id,
    name: team.name,
    code: team.code,
    group_code: team.group_code || '',
  }));

  const tournamentMatches = matches
    .filter((match) => match.round === 'group')
    .map((match) => ({
      id: match.id,
      team1_id: match.team1_id || '',
      team2_id: match.team2_id || '',
      group_code: match.group_code || '',
      round: 'group' as const,
    }));

  const tournamentMatchResults = matchResults.map((result) => ({
    match_id: result.match_id,
    team1_score: result.team1_score,
    team2_score: result.team2_score,
  }));

  const groupStandings = calculateGroupStandings(
    tournamentTeams,
    tournamentMatches,
    tournamentMatchResults,
    groupTiebreaks,
  );
  const bestThirds = calculateBestThirds(groupStandings.thirdPlaceTeams, bestThirdsTiebreak);

  const bracketMatches = matches
    .filter((match) => match.round !== 'group')
    .map((match) => ({
      id: match.id,
      num: match.match_number ?? undefined,
      round: match.round as
        | 'round_of_32'
        | 'round_of_16'
        | 'quarter_final'
        | 'semi_final'
        | 'third_place'
        | 'final',
      date: match.match_date,
      time: match.match_time,
      ground: match.venue,
      team1_id: match.team1_id ?? undefined,
      team2_id: match.team2_id ?? undefined,
      team1_slot: match.team1_slot as
        | `${number}${'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'}`
        | `3${string}`
        | `W${number}`
        | `L${number}`
        | undefined,
      team2_slot: match.team2_slot as
        | `${number}${'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'}`
        | `3${string}`
        | `W${number}`
        | `L${number}`
        | undefined,
    }));

  const bracketMatchResults = matchResults.map((result) => ({
    match_id: result.match_id,
    team1_score: result.team1_score,
    team2_score: result.team2_score,
    winner_team_id: result.winner_team_id ?? undefined,
  }));

  const officialBracket = resolveBracket(
    bracketMatches,
    bracketMatchResults,
    groupStandings,
    bestThirds,
    groupTiebreaks,
  );

  const officialMatchById = new Map(
    officialBracket.matches.map((resolvedMatch) => [resolvedMatch.match.id, resolvedMatch]),
  );

  const visibleMembers = (membersData.data ?? []).filter((member) => {
    if (globalAdminIds.has(member.user_id)) {
      return false;
    }
    return !member.hidden_from_leaderboard;
  });

  const emailByUserId = await loadUserEmails(visibleMembers.map((member) => member.user_id));

  const predictedTournamentMatches = matches.map((match) => ({
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
  }));

  const predictedTournamentTeams = teams.map((team) => ({
    id: team.id,
    name: team.name,
    code: team.code,
    group_code: team.group_code,
  }));

  const allRows: AuditRow[] = [];
  const falsePositiveRows: AuditRow[] = [];
  const falseNegativeRows: AuditRow[] = [];

  for (const member of visibleMembers) {
    const profileRaw = member.profiles;
    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as ProfileRow | null;
    const username = profile?.username ?? '(sin username)';
    const email = emailByUserId.get(member.user_id) ?? '(sin email)';

    const [predictionsScoresData, predictionManualTiebreaksData, scoreBreakdownData] = await Promise.all([
      supabase
        .from('predictions_scores')
        .select('*')
        .eq('group_id', GROUP_ID)
        .eq('user_id', member.user_id),
      supabase
        .from('prediction_manual_tiebreaks')
        .select('*')
        .eq('group_id', GROUP_ID)
        .eq('user_id', member.user_id)
        .eq('type', 'group_tiebreak'),
      supabase
        .from('score_breakdowns')
        .select('*')
        .eq('group_id', GROUP_ID)
        .eq('user_id', member.user_id)
        .maybeSingle(),
    ]);

    if (predictionsScoresData.error) throw predictionsScoresData.error;
    if (predictionManualTiebreaksData.error) throw predictionManualTiebreaksData.error;
    if (scoreBreakdownData.error) throw scoreBreakdownData.error;

    const predictionsScores = predictionsScoresData.data as PredictionScoreRow[];
    const predictionManualTiebreaks = predictionManualTiebreaksData.data as PredictionManualTiebreakRow[];
    const scoreBreakdown = scoreBreakdownData.data as ScoreBreakdownRow | null;

    const matchPredictions = predictionsScores.map((prediction) => ({
      match_id: prediction.match_id,
      predicted_team1_score: prediction.predicted_team1_score,
      predicted_team2_score: prediction.predicted_team2_score,
      predicted_winner_team_id: prediction.predicted_winner_team_id,
    }));

    const groupManualTiebreaks = predictionManualTiebreaks.map((tiebreak) => ({
      type: 'group' as const,
      reference: tiebreak.reference.startsWith('group_')
        ? tiebreak.reference
        : `group_${tiebreak.reference}`,
      ordered_team_ids: tiebreak.ordered_team_ids,
    }));

    const predictedTournament = buildPredictedTournamentFromScores(
      predictedTournamentTeams,
      predictedTournamentMatches,
      matchPredictions,
      groupManualTiebreaks,
    );

    const predictedMatchById = new Map(
      predictedTournament.bracket.matches.map((resolvedMatch) => [resolvedMatch.match.id, resolvedMatch]),
    );
    const predictionByMatchId = new Map(predictionsScores.map((prediction) => [prediction.match_id, prediction]));

    const details = (scoreBreakdown?.details ?? {}) as ScoreBreakdownDetails;
    const awardedByMatchId = new Map(
      (details.knockoutExact ?? []).map((entry) => [entry.match_id, entry.points]),
    );

    for (const match of knockoutMatchesWithResults) {
      const realResult = resultByMatchId.get(match.id);
      const prediction = predictionByMatchId.get(match.id);
      const officialMatch = officialMatchById.get(match.id);
      const predictedMatch = predictedMatchById.get(match.id);

      if (!realResult) {
        continue;
      }

      const realTeam1Id = officialMatch?.team1_id ?? match.team1_id;
      const realTeam2Id = officialMatch?.team2_id ?? match.team2_id;
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

      // Regardless of prediction presence, compute real winner for display
      const realWinnerForDisplay =
        officialMatchup != null
          ? inferKnockoutWinner(
              realResult.winner_team_id,
              realResult.team1_score,
              realResult.team2_score,
              officialMatchup.team1_id,
              officialMatchup.team2_id,
            )
          : realResult.winner_team_id;

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
        : {
            score_matches: false,
            matchup_matches_same_order: false,
            matchup_matches_swapped: false,
            real_winner: realWinnerForDisplay,
            predicted_winner_raw: null,
            predicted_winner_inferred: null,
            winner_matches: false,
            should_award: false,
            points: 0,
          };

      const currentlyAwarded = awardedByMatchId.get(match.id) ?? 0;

      let issueType: IssueType = 'ok';
      if (currentlyAwarded > 0 && !evaluation.should_award) {
        issueType = 'false_positive';
      } else if (evaluation.should_award && currentlyAwarded === 0) {
        issueType = 'false_negative';
      }

      const row: AuditRow = {
        email,
        username,
        match_id: match.id,
        match_number: match.match_number ?? null,
        round: match.round,
        real_teams: formatTeamPair(realTeam1Id, realTeam2Id, teamById),
        predicted_teams: formatTeamPair(predictedTeam1Id, predictedTeam2Id, teamById),
        real_score: formatScore(realResult.team1_score, realResult.team2_score),
        predicted_score: formatScore(
          prediction?.predicted_team1_score,
          prediction?.predicted_team2_score,
        ),
        real_winner: formatTeamLabel(evaluation.real_winner, teamById),
        predicted_winner_raw: formatTeamLabel(evaluation.predicted_winner_raw, teamById),
        predicted_winner_inferred: formatTeamLabel(evaluation.predicted_winner_inferred, teamById),
        matchup_matches_same_order: evaluation.matchup_matches_same_order,
        matchup_matches_swapped: evaluation.matchup_matches_swapped,
        score_matches: evaluation.score_matches,
        winner_matches: evaluation.winner_matches,
        currently_awarded: currentlyAwarded,
        should_award: evaluation.should_award,
        issue_type: issueType,
      };

      allRows.push(row);
      if (issueType === 'false_positive') {
        falsePositiveRows.push(row);
      } else if (issueType === 'false_negative') {
        falseNegativeRows.push(row);
      }
    }
  }

  const braJpnFalseNegatives = falseNegativeRows.filter((row) => {
    const match = matchById.get(row.match_id);
    const officialMatch = officialMatchById.get(row.match_id);
    const realTeam1Id = officialMatch?.team1_id ?? match?.team1_id;
    const realTeam2Id = officialMatch?.team2_id ?? match?.team2_id;
    return teamPairIncludesCodes(realTeam1Id, realTeam2Id, teamById, ['BRA', 'JPN']);
  });

  console.log(`Visible users audited: ${visibleMembers.length}`);
  console.log(`Knockout matches with real results: ${knockoutMatchesWithResults.length}`);
  console.log(`Rows evaluated: ${allRows.length}`);
  console.log(`False positives: ${falsePositiveRows.length}`);
  console.log(`False negatives: ${falseNegativeRows.length}`);
  console.log(`False negatives (Brasil vs Japón): ${braJpnFalseNegatives.length}\n`);

  if (falsePositiveRows.length === 0) {
    console.log('No false positive knockoutExact awards found.');
  } else {
    console.log('False positive knockoutExact awards:');
    console.table(falsePositiveRows.map(toAuditTableRow));
  }

  console.log('');

  if (falseNegativeRows.length === 0) {
    console.log('No false negative knockoutExact awards found.');
  } else {
    console.log('False negative knockoutExact awards:');
    console.table(falseNegativeRows.map(toAuditTableRow));
  }

  console.log('');

  if (braJpnFalseNegatives.length === 0) {
    console.log('No Brasil vs Japón false negatives found.');
  } else {
    console.log('Brasil vs Japón false negatives (should have knockoutExact but do not):');
    console.table(braJpnFalseNegatives.map(toAuditTableRow));
  }
}

main().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
