#!/usr/bin/env npx tsx
/**
 * Read-only audit: knockoutExact points vs predicted bracket matchups.
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

interface AuditRow {
  email: string;
  username: string;
  match_id: string;
  match_number: number | null;
  round: string;
  real_score: string;
  real_teams: string;
  predicted_score: string;
  predicted_teams: string;
  matchup_matches: boolean;
  score_matches: boolean;
  points_awarded: number;
  suspicious: boolean;
}

function formatTeamPair(
  team1Id: string | null | undefined,
  team2Id: string | null | undefined,
  teamById: Map<string, TeamRow>,
): string {
  const team1 = team1Id ? teamById.get(team1Id) : undefined;
  const team2 = team2Id ? teamById.get(team2Id) : undefined;
  const label1 = team1 ? `${team1.name} (${team1.code})` : team1Id ?? '?';
  const label2 = team2 ? `${team2.name} (${team2.code})` : team2Id ?? '?';
  return `${label1} vs ${label2}`;
}

function formatScore(team1Score: number | null | undefined, team2Score: number | null | undefined): string {
  if (team1Score == null || team2Score == null) {
    return '?';
  }
  return `${team1Score} - ${team2Score}`;
}

function matchupMatches(
  realTeam1Id: string | null | undefined,
  realTeam2Id: string | null | undefined,
  predictedTeam1Id: string | null | undefined,
  predictedTeam2Id: string | null | undefined,
): boolean {
  if (!realTeam1Id || !realTeam2Id || !predictedTeam1Id || !predictedTeam2Id) {
    return false;
  }

  return realTeam1Id === predictedTeam1Id && realTeam2Id === predictedTeam2Id;
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
  const suspiciousRows: AuditRow[] = [];

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
    const knockoutExactEntries = details.knockoutExact ?? [];

    for (const entry of knockoutExactEntries) {
      const match = matchById.get(entry.match_id);
      const realResult = resultByMatchId.get(entry.match_id);
      const predictedMatch = predictedMatchById.get(entry.match_id);
      const prediction = predictionByMatchId.get(entry.match_id);

      const officialMatch = officialMatchById.get(entry.match_id);
      const realTeam1Id = officialMatch?.team1_id ?? match?.team1_id;
      const realTeam2Id = officialMatch?.team2_id ?? match?.team2_id;
      const predictedTeam1Id = predictedMatch?.team1_id;
      const predictedTeam2Id = predictedMatch?.team2_id;

      const scoreMatches =
        prediction != null &&
        realResult != null &&
        prediction.predicted_team1_score === realResult.team1_score &&
        prediction.predicted_team2_score === realResult.team2_score;

      const teamsMatch = matchupMatches(realTeam1Id, realTeam2Id, predictedTeam1Id, predictedTeam2Id);

      const suspicious = entry.points === 10 && scoreMatches && !teamsMatch;

      const row: AuditRow = {
        email,
        username,
        match_id: entry.match_id,
        match_number: match?.match_number ?? null,
        round: match?.round ?? '?',
        real_score: formatScore(realResult?.team1_score, realResult?.team2_score),
        real_teams: formatTeamPair(realTeam1Id, realTeam2Id, teamById),
        predicted_score: formatScore(
          prediction?.predicted_team1_score,
          prediction?.predicted_team2_score,
        ),
        predicted_teams: formatTeamPair(predictedTeam1Id, predictedTeam2Id, teamById),
        matchup_matches: teamsMatch,
        score_matches: scoreMatches,
        points_awarded: entry.points,
        suspicious,
      };

      allRows.push(row);
      if (suspicious) {
        suspiciousRows.push(row);
      }
    }
  }

  console.log(`Visible users audited: ${visibleMembers.length}`);
  console.log(`knockoutExact entries found: ${allRows.length}`);
  console.log(`Suspicious entries: ${suspiciousRows.length}\n`);

  if (suspiciousRows.length === 0) {
    console.log('No suspicious knockoutExact awards found.');
  } else {
    console.log('Suspicious knockoutExact awards:');
    console.table(suspiciousRows);
  }
}

main().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
