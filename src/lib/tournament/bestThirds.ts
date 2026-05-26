/**
 * Pure TypeScript engine for calculating best third-place teams
 * No database connections, no React components
 */

import { TeamStats } from './groupStandings';

// Re-export TeamStats for convenience
export type { TeamStats };

// ============================================================================
// TYPES
// ============================================================================

export interface ManualTiebreak {
  type: 'best_thirds';
  reference: string; // e.g., 'best_thirds_2026'
  ordered_team_ids: string[];
}

export interface BestThirdsOutput {
  qualifiedThirds: TeamStats[]; // Top 8 third-place teams
  eliminatedThirds: TeamStats[]; // Bottom 4 third-place teams
  orderedThirds: TeamStats[]; // All 12 ordered when possible
  requiresManualTiebreak: boolean;
  pending: boolean; // true if fewer than 12 third-place teams
  tiedInsideQualified: string[][]; // groups of tied team_ids within qualified (doesn't block)
  tiedInsideEliminated: string[][]; // groups of tied team_ids within eliminated (doesn't block)
  tiedAtCut: string[]; // team_ids tied across the 8/9 cut (blocks)
}

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Calculate the best 8 third-place teams from 12 groups
 * This is a pure function with no side effects
 */
export function calculateBestThirds(
  thirdPlaceTeams: TeamStats[],
  manualTiebreak?: ManualTiebreak
): BestThirdsOutput {
  // Check if we have all 12 third-place teams
  if (thirdPlaceTeams.length < 12) {
    return {
      qualifiedThirds: [],
      eliminatedThirds: [],
      orderedThirds: [...thirdPlaceTeams],
      requiresManualTiebreak: false,
      pending: true,
      tiedInsideQualified: [],
      tiedInsideEliminated: [],
      tiedAtCut: [],
    };
  }

  let sorted: TeamStats[];

  // If manual tiebreak is provided, use it as the final order
  if (manualTiebreak) {
    sorted = applyManualTiebreak([...thirdPlaceTeams], manualTiebreak);
    // When manual tiebreak is provided, no tie analysis needed
    // The manual order is considered final
    const qualifiedThirds = sorted.slice(0, 8);
    const eliminatedThirds = sorted.slice(8);

    return {
      qualifiedThirds,
      eliminatedThirds,
      orderedThirds: sorted,
      requiresManualTiebreak: false,
      pending: false,
      tiedInsideQualified: [],
      tiedInsideEliminated: [],
      tiedAtCut: [],
    };
  }

  // Sort by criteria: points (desc), goal difference (desc), goals for (desc)
  sorted = [...thirdPlaceTeams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  // Find ties
  const tieAnalysis = analyzeTies(sorted);

  // Split into qualified (top 8) and eliminated (bottom 4)
  const qualifiedThirds = sorted.slice(0, 8);
  const eliminatedThirds = sorted.slice(8);

  return {
    qualifiedThirds,
    eliminatedThirds,
    orderedThirds: sorted,
    requiresManualTiebreak: tieAnalysis.tiedAtCut.length > 0,
    pending: false,
    tiedInsideQualified: tieAnalysis.tiedInsideQualified,
    tiedInsideEliminated: tieAnalysis.tiedInsideEliminated,
    tiedAtCut: tieAnalysis.tiedAtCut,
  };
}

/**
 * Apply manual tiebreak order to teams
 */
function applyManualTiebreak(
  teams: TeamStats[],
  manualTiebreak: ManualTiebreak
): TeamStats[] {
  const teamMap = new Map<string, TeamStats>();
  for (const team of teams) {
    teamMap.set(team.team_id, team);
  }

  const ordered: TeamStats[] = [];
  for (const teamId of manualTiebreak.ordered_team_ids) {
    const team = teamMap.get(teamId);
    if (team) {
      ordered.push(team);
      teamMap.delete(teamId);
    }
  }

  // Add any remaining teams not in the manual order
  for (const team of teamMap.values()) {
    ordered.push(team);
  }

  return ordered;
}

/**
 * Analyze ties in the sorted third-place teams
 * Identifies:
 * - Ties within qualified (positions 1-8) that don't affect qualification
 * - Ties within eliminated (positions 9-12) that don't affect qualification
 * - Ties that cross the 8/9 cut (affects qualification, requires manual tiebreak)
 */
function analyzeTies(sorted: TeamStats[]): {
  tiedInsideQualified: string[][];
  tiedInsideEliminated: string[][];
  tiedAtCut: string[];
} {
  const tiedInsideQualified: string[][] = [];
  const tiedInsideEliminated: string[][] = [];
  const tiedAtCut: string[] = [];

  // Find groups of tied teams (same points, goal difference, and goals for)
  const tiedGroups = findTiedGroups(sorted);

  for (const group of tiedGroups) {
    if (group.length === 1) continue;

    const positions = group.map((team) => sorted.indexOf(team));
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);

    // Check if this tie crosses the 8/9 cut
    if (minPos < 8 && maxPos >= 8) {
      // Tie crosses the cut - this blocks qualification
      tiedAtCut.push(...group.map((t) => t.team_id));
    } else if (maxPos < 8) {
      // Tie is entirely within qualified positions
      tiedInsideQualified.push(group.map((t) => t.team_id));
    } else if (minPos >= 8) {
      // Tie is entirely within eliminated positions
      tiedInsideEliminated.push(group.map((t) => t.team_id));
    }
  }

  return {
    tiedInsideQualified,
    tiedInsideEliminated,
    tiedAtCut,
  };
}

/**
 * Find groups of teams with identical stats (points, goal difference, goals for)
 */
function findTiedGroups(standings: TeamStats[]): TeamStats[][] {
  const groups: TeamStats[][] = [];
  let currentGroup: TeamStats[] = [];

  for (let i = 0; i < standings.length; i++) {
    if (currentGroup.length === 0) {
      currentGroup.push(standings[i]);
    } else {
      const last = currentGroup[0];
      const current = standings[i];

      if (current.points === last.points &&
          current.goalDifference === last.goalDifference &&
          current.goalsFor === last.goalsFor) {
        currentGroup.push(current);
      } else {
        if (currentGroup.length > 1) {
          groups.push(currentGroup);
        }
        currentGroup = [current];
      }
    }
  }

  if (currentGroup.length > 1) {
    groups.push(currentGroup);
  }

  return groups;
}
