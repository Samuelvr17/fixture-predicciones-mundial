/**
 * src/lib/tournament/teamAdvances.ts
 *
 * Pure functions for calculating team advancement rounds from bracket results
 * No database connections, no React components
 */

import type { TournamentRound } from '@/lib/scoring/scoring';
import { areAllGroupsResolved, isGroupResolved, type GroupStandingsOutput } from './groupStandings';
import type { BestThirdsOutput } from './bestThirds';
import type { BracketOutput } from './bracket';

/**
 * Build team advances map from bracket output
 * This maps each team to the furthest round they reached
 * 
 * Rules:
 * - All teams start as no_clasifica
 * - First and second place teams reach round_of_32
 * - Only the 8 best thirds (qualifiedThirds) reach round_of_32
 * - Winner of round_of_32 reaches round_of_16
 * - Winner of round_of_16 reaches quarter_final
 * - Winner of quarter_final reaches semi_final
 * - Winner of semi_final reaches final
 * - Winner of final reaches champion
 * - The third_place match does NOT modify team_advances
 * - The actual third place is handled separately with bracketOutput.thirdPlace
 */
export function buildTeamAdvancesFromBracket(
  bracketOutput: BracketOutput,
  groupStandings: GroupStandingsOutput,
  bestThirds: BestThirdsOutput
): Record<string, TournamentRound> {
  const teamAdvances: Record<string, TournamentRound> = {};

  // Round order for comparison
  const roundOrder: TournamentRound[] = [
    'no_clasifica',
    'round_of_32',
    'round_of_16',
    'quarter_final',
    'semi_final',
    'final',
    'champion',
  ];

  /**
   * Helper to set the maximum round for a team
   * Only updates if the new round is higher than the current one
   */
  function setMaxRound(teamId: string, round: TournamentRound): void {
    const currentIndex = roundOrder.indexOf(teamAdvances[teamId] || 'no_clasifica');
    const newIndex = roundOrder.indexOf(round);
    if (newIndex > currentIndex) {
      teamAdvances[teamId] = round;
    }
  }

  // a. Initialize all teams as no_clasifica
  for (const groupCode in groupStandings.standings) {
    const group = groupStandings.standings[groupCode];
    for (const team of group.standings) {
      teamAdvances[team.team_id] = 'no_clasifica';
    }
  }

  // b. Mark first and second place teams as round_of_32 only when that
  // group's official standings are final. Partial standings must not award
  // advancement points because they can change as the admin enters results.
  for (const groupCode in groupStandings.standings) {
    const group = groupStandings.standings[groupCode];
    if (isGroupResolved(group) && group.standings.length >= 2) {
      setMaxRound(group.standings[0].team_id, 'round_of_32');
      setMaxRound(group.standings[1].team_id, 'round_of_32');
    }
  }

  // c. Mark only the 8 best thirds as round_of_32 once every group is resolved
  // and the best-thirds cut is no longer pending. Before that point, these
  // places are not official and should not generate progressive points.
  if (areAllGroupsResolved(groupStandings) && !bestThirds.pending && !bestThirds.requiresManualTiebreak) {
    for (const team of bestThirds.qualifiedThirds) {
      setMaxRound(team.team_id, 'round_of_32');
    }
  }

  // d. Process bracket matches (excluding third_place)
  // Map round to the round the winner advances to
  const roundMap: Record<string, TournamentRound> = {
    'round_of_32': 'round_of_16',
    'round_of_16': 'quarter_final',
    'quarter_final': 'semi_final',
    'semi_final': 'final',
    'final': 'champion',
  };

  for (const resolvedMatch of bracketOutput.matches) {
    // e. Ignore third_place matches
    if (resolvedMatch.match.round === 'third_place') {
      continue;
    }

    if (resolvedMatch.pendingSlots.length > 0) {
      continue;
    }

    if (resolvedMatch.winner_team_id) {
      const currentRound = resolvedMatch.match.round;
      const winnerId = resolvedMatch.winner_team_id;
      const nextRound = roundMap[currentRound];
      
      if (nextRound) {
        setMaxRound(winnerId, nextRound);
      }
    }
  }

  return teamAdvances;
}
