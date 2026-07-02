#!/usr/bin/env npx tsx
/**
 * Repair script: invalid predicted winners in bracket predictions.
 *
 * Reconstructs each user's predictedTournament using the same logic as
 * recalculateGroupScores (src/server/scoring/recalculateScores.ts) and
 * repairs invalid predicted_winner_team_id values.
 *
 * By default, runs in READ-ONLY preview mode. Pass --apply to write changes.
 *
 * Repair logic:
 * - If score is tied and raw winner invalid belongs to team2 slot, map to team2 reconstructed
 * - If belongs to team1 slot, map to team1 reconstructed
 * - If cannot infer side safely, report "needs manual decision"
 *
 * Usage:
 *   npx tsx scripts/repair-predicted-bracket-invalid-winners.ts          # preview mode
 *   npx tsx scripts/repair-predicted-bracket-invalid-winners.ts --apply  # apply changes
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
const APPLY_MODE = process.argv.includes('--apply');

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

interface RepairRow {
  email: string;
  username: string;
  match_number: number | null;
  old_winner_code: string;
  new_winner_code: string | null;
  team1_code: string;
  team2_code: string;
  reason: string;
  safe_to_apply: boolean;
  prediction_id: string;
  user_id: string;
  match_id: string;
  new_winner_id: string | null;
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

function getTeamCode(teamId: string | null | undefined, teamById: Map<string, TeamRow>): string {
  if (!teamId) return '(null)';
  const team = teamById.get(teamId);
  return team?.code ?? teamId;
}

/**
 * Determines which slot a team belongs to in a match.
 * Returns 'team1', 'team2', or null if cannot determine.
 */
function inferTeamSlot(
  teamId: string,
  match: MatchRow,
  teamById: Map<string, TeamRow>,
): 'team1' | 'team2' | null {
  const team = teamById.get(teamId);
  if (!team) return null;

  // Check if the team is the original team1_id from the match definition
  if (match.team1_id && teamId === match.team1_id) {
    return 'team1';
  }
  
  // Check if the team is the original team2_id from the match definition
  if (match.team2_id && teamId === match.team2_id) {
    return 'team2';
  }

  // For knockout matches with slots, check if team's group matches the slot
  if (match.team1_slot && match.team2_slot) {
    const teamGroup = team.group_code;
    
    // Parse slot patterns like "1D" (group D winner) or "3B/E/F/I/J" (best third from groups B,E,F,I,J)
    const team1MatchesSlot = matchesSlotGroup(match.team1_slot, teamGroup || '');
    const team2MatchesSlot = matchesSlotGroup(match.team2_slot, teamGroup || '');
    
    if (team1MatchesSlot && !team2MatchesSlot) {
      return 'team1';
    }
    if (team2MatchesSlot && !team1MatchesSlot) {
      return 'team2';
    }
  }
  
  // Cannot safely determine slot
  return null;
}

/**
 * Checks if a team's group matches a slot pattern.
 * Slot patterns can be:
 * - "1A" - winner of group A
 * - "2A" - runner-up of group A
 * - "3A/B/C" - best third from groups A, B, or C
 */
function matchesSlotGroup(slot: string, teamGroup: string): boolean {
  // Remove any prefix numbers (1, 2, 3) to get the group pattern
  const groupPattern = slot.replace(/^[123]/, '');
  
  // If pattern contains multiple groups separated by /
  if (groupPattern.includes('/')) {
    const groups = groupPattern.split('/');
    return groups.includes(teamGroup);
  }
  
  // Single group
  return groupPattern === teamGroup;
}

async function main() {
  console.log('Repair predicted bracket invalid winners');
  console.log(`Group: ${GROUP_ID}`);
  console.log(`Mode: ${APPLY_MODE ? 'APPLY (write mode)' : 'PREVIEW (read-only)'}`);
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
  const teamIdByCode = new Map(teams.map((team) => [team.code, team.id]));
  const emailByUserId = await loadUserEmails(visibleMembers.map((member) => member.user_id));
  
  const repairs: RepairRow[] = [];
  let matchesChecked = 0;

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

      // Check if raw predicted winner is invalid (not team1 or team2 of reconstructed match)
      if (rawPredictedWinnerId && team1Id && team2Id) {
        if (rawPredictedWinnerId !== team1Id && rawPredictedWinnerId !== team2Id) {
          // Invalid winner detected
          const isTiedScore =
            prediction.predicted_team1_score !== null &&
            prediction.predicted_team2_score !== null &&
            prediction.predicted_team1_score === prediction.predicted_team2_score;
          
          // Infer which slot the invalid winner belongs to
          const inferredSlot = inferTeamSlot(rawPredictedWinnerId, match, teamById);
          
          let newWinnerId: string | null = null;
          let newWinnerCode: string | null = null;
          let reason: string;
          let safeToApply: boolean;

          if (inferredSlot === 'team1' && team1Id) {
            // Map to reconstructed team1
            newWinnerId = team1Id;
            newWinnerCode = team1Code;
            reason = `Invalid winner (${rawPredictedWinnerCode}) belongs to team1 slot, mapping to reconstructed team1 (${team1Code})`;
            safeToApply = isTiedScore; // Safe if score is tied
          } else if (inferredSlot === 'team2' && team2Id) {
            // Map to reconstructed team2
            newWinnerId = team2Id;
            newWinnerCode = team2Code;
            reason = `Invalid winner (${rawPredictedWinnerCode}) belongs to team2 slot, mapping to reconstructed team2 (${team2Code})`;
            safeToApply = isTiedScore; // Safe if score is tied
          } else {
            // Cannot infer side safely
            newWinnerId = null;
            newWinnerCode = null;
            reason = `Invalid winner (${rawPredictedWinnerCode}) cannot be safely mapped to a side - needs manual decision`;
            safeToApply = false;
          }

          if (!safeToApply) {
            reason += ' (score not tied - manual decision required)';
          }

          repairs.push({
            email,
            username,
            match_number: match.match_number,
            old_winner_code: rawPredictedWinnerCode,
            new_winner_code: newWinnerCode,
            team1_code: team1Code,
            team2_code: team2Code,
            reason,
            safe_to_apply: safeToApply,
            prediction_id: prediction.id,
            user_id: userId,
            match_id: match.id,
            new_winner_id: newWinnerId,
          });
        }
      }
    }
  }

  console.log(`Visible users audited: ${visibleMembers.length}`);
  console.log(`Matches checked: ${matchesChecked}`);
  console.log(`Repairs needed: ${repairs.length}\n`);

  if (repairs.length > 0) {
    console.table(
      repairs.map((rep) => ({
        email: rep.email,
        username: rep.username,
        match_number: rep.match_number ?? '',
        old_winner_code: rep.old_winner_code,
        new_winner_code: rep.new_winner_code ?? '(manual)',
        team1_code: rep.team1_code,
        team2_code: rep.team2_code,
        reason: rep.reason,
        safe_to_apply: rep.safe_to_apply ? 'YES' : 'NO',
      })),
    );

    const safeRepairs = repairs.filter((rep) => rep.safe_to_apply);
    console.log(`\nSafe to apply automatically: ${safeRepairs.length}`);
    console.log(`Needs manual decision: ${repairs.length - safeRepairs.length}`);

    if (APPLY_MODE) {
      console.log('\n=== APPLYING CHANGES ===\n');
      
      let appliedCount = 0;
      for (const repair of safeRepairs) {
        const { error } = await supabase
          .from('predictions_scores')
          .update({ predicted_winner_team_id: repair.new_winner_id })
          .eq('id', repair.prediction_id);
        
        if (error) {
          console.error(`Failed to update prediction ${repair.prediction_id}:`, error);
        } else {
          appliedCount++;
          console.log(`Updated: ${repair.email} - Match #${repair.match_number} - ${repair.old_winner_code} -> ${repair.new_winner_code}`);
        }
      }

      console.log(`\nApplied ${appliedCount} repairs successfully.`);
      
      if (appliedCount > 0) {
        console.log('\n=== IMPORTANT ===');
        console.log('After applying repairs, you should run recalculateAllGroupScores');
        console.log('to rebuild score_breakdowns using the normal scoring engine.');
        console.log('This ensures all scoring calculations are consistent.');
      }
    } else {
      console.log('\n=== PREVIEW MODE - NO CHANGES APPLIED ===');
      console.log('Run with --apply flag to apply safe repairs automatically.');
    }
  } else {
    console.log('No repairs needed.');
  }
}

main().catch((error) => {
  console.error('Repair failed:', error);
  process.exit(1);
});
