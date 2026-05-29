/**
 * Build a user's predicted tournament path from match score predictions.
 *
 * This keeps advancement predictions derived from the user's bracket instead of
 * asking users to maintain a second, potentially contradictory, set of picks.
 */

import { calculateBestThirds } from './bestThirds';
import {
  calculateGroupStandings,
  type Match as GroupMatch,
  type MatchResult as GroupMatchResult,
  type Team as GroupTeam,
} from './groupStandings';
import {
  resolveBracket,
  type BracketOutput,
  type Match as BracketMatch,
  type MatchResult as BracketMatchResult,
} from './bracket';
import { buildTeamAdvancesFromBracket } from './teamAdvances';
import type { TournamentRound } from '@/lib/scoring/scoring';

export interface PredictedTournamentTeam {
  id: string;
  name: string;
  code: string;
  group_code: string | null;
}

export interface PredictedTournamentMatch {
  id: string;
  match_number: number | null;
  round:
    | 'group'
    | 'round_of_32'
    | 'round_of_16'
    | 'quarter_final'
    | 'semi_final'
    | 'third_place'
    | 'final';
  group_code: string | null;
  match_date: string;
  match_time: string;
  venue: string;
  team1_id: string | null;
  team2_id: string | null;
  team1_slot: string | null;
  team2_slot: string | null;
}

export interface PredictedScore {
  match_id: string;
  predicted_team1_score: number;
  predicted_team2_score: number;
  predicted_winner_team_id?: string | null;
}

export interface PredictedTournamentOutput {
  groupStandings: ReturnType<typeof calculateGroupStandings>;
  bestThirds: ReturnType<typeof calculateBestThirds>;
  bracket: BracketOutput;
  teamAdvances: Record<string, TournamentRound>;
  championTeamId: string | null;
  thirdPlaceTeamId: string | null;
}

const KNOCKOUT_ROUNDS = new Set([
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
]);

export function buildPredictedTournamentFromScores(
  teams: PredictedTournamentTeam[],
  matches: PredictedTournamentMatch[],
  predictions: PredictedScore[]
): PredictedTournamentOutput {
  const predictionByMatchId = new Map(predictions.map((p) => [p.match_id, p]));

  const groupTeams: GroupTeam[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    code: team.code,
    group_code: team.group_code || '',
  }));

  const groupMatches: GroupMatch[] = matches
    .filter((match) => match.round === 'group' && match.team1_id && match.team2_id && match.group_code)
    .map((match) => ({
      id: match.id,
      team1_id: match.team1_id!,
      team2_id: match.team2_id!,
      group_code: match.group_code!,
      round: 'group',
    }));

  const groupResults: GroupMatchResult[] = groupMatches
    .map((match) => {
      const prediction = predictionByMatchId.get(match.id);
      if (!prediction) return null;

      return {
        match_id: match.id,
        team1_score: prediction.predicted_team1_score,
        team2_score: prediction.predicted_team2_score,
      };
    })
    .filter((result): result is GroupMatchResult => result !== null);

  const groupStandings = calculateGroupStandings(groupTeams, groupMatches, groupResults);
  const bestThirds = calculateBestThirds(groupStandings.thirdPlaceTeams);

  const bracketMatches: BracketMatch[] = matches
    .filter((match) => KNOCKOUT_ROUNDS.has(match.round))
    .map((match) => ({
      id: match.id,
      num: match.match_number ?? undefined,
      round: match.round as BracketMatch['round'],
      date: match.match_date,
      time: match.match_time,
      ground: match.venue,
      team1_id: match.team1_id ?? undefined,
      team2_id: match.team2_id ?? undefined,
      team1_slot: match.team1_slot as BracketMatch['team1_slot'],
      team2_slot: match.team2_slot as BracketMatch['team2_slot'],
    }));

  const bracketResults: BracketMatchResult[] = [];
  for (const match of bracketMatches) {
    const prediction = predictionByMatchId.get(match.id);
    if (prediction) {
      bracketResults.push({
        match_id: match.id,
        team1_score: prediction.predicted_team1_score,
        team2_score: prediction.predicted_team2_score,
        winner_team_id: prediction.predicted_winner_team_id ?? undefined,
      });
    }
  }

  const bracket = resolveBracket(bracketMatches, bracketResults, groupStandings, bestThirds);
  const teamAdvances = buildTeamAdvancesFromBracket(bracket, groupStandings, bestThirds);

  return {
    groupStandings,
    bestThirds,
    bracket,
    teamAdvances,
    championTeamId: bracket.champion ?? null,
    thirdPlaceTeamId: bracket.thirdPlace ?? null,
  };
}
