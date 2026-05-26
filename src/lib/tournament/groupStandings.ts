/**
 * Pure TypeScript engine for calculating group standings
 * No database connections, no React components
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Team {
  id: string;
  name: string;
  code: string;
  group_code: string;
}

export interface Match {
  id: string;
  team1_id: string;
  team2_id: string;
  group_code: string;
  round: 'group';
}

export interface MatchResult {
  match_id: string;
  team1_score: number;
  team2_score: number;
}

export interface TeamStats {
  team_id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GroupStandings {
  group_code: string;
  standings: TeamStats[];
  requiresManualTiebreak: boolean;
  tiedTeams: string[]; // team_ids that are tied and require manual resolution
}

export interface GroupStandingsOutput {
  standings: Record<string, GroupStandings>; // group_code -> GroupStandings
  thirdPlaceTeams: TeamStats[]; // All third-place teams (not yet ranked)
  requiresManualTiebreak: boolean;
}

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Calculate group standings from teams, matches, and results
 * This is a pure function with no side effects
 */
export function calculateGroupStandings(
  teams: Team[],
  matches: Match[],
  results: MatchResult[]
): GroupStandingsOutput {
  // Create a map of match_id -> result for quick lookup
  const resultMap = new Map<string, MatchResult>();
  for (const result of results) {
    resultMap.set(result.match_id, result);
  }

  // Group teams by group_code
  const teamsByGroup = new Map<string, Team[]>();
  for (const team of teams) {
    if (!teamsByGroup.has(team.group_code)) {
      teamsByGroup.set(team.group_code, []);
    }
    teamsByGroup.get(team.group_code)!.push(team);
  }

  // Group matches by group_code
  const matchesByGroup = new Map<string, Match[]>();
  for (const match of matches) {
    if (!matchesByGroup.has(match.group_code)) {
      matchesByGroup.set(match.group_code, []);
    }
    matchesByGroup.get(match.group_code)!.push(match);
  }

  // Calculate standings for each group
  const standings: Record<string, GroupStandings> = {};
  let globalRequiresManualTiebreak = false;

  for (const [groupCode, groupTeams] of teamsByGroup) {
    const groupMatches = matchesByGroup.get(groupCode) || [];
    const groupResult = calculateSingleGroupStandings(groupTeams, groupMatches, resultMap);
    standings[groupCode] = groupResult;

    if (groupResult.requiresManualTiebreak) {
      globalRequiresManualTiebreak = true;
    }
  }

  // Extract third-place teams
  const thirdPlaceTeams: TeamStats[] = [];
  for (const groupCode in standings) {
    const groupStandings = standings[groupCode];
    if (groupStandings.standings.length >= 3) {
      // Third place is at index 2 (0-indexed)
      thirdPlaceTeams.push(groupStandings.standings[2]);
    }
  }

  return {
    standings,
    thirdPlaceTeams,
    requiresManualTiebreak: globalRequiresManualTiebreak,
  };
}

/**
 * Calculate standings for a single group
 */
function calculateSingleGroupStandings(
  teams: Team[],
  matches: Match[],
  resultMap: Map<string, MatchResult>
): GroupStandings {
  // Initialize stats for each team
  const statsMap = new Map<string, TeamStats>();
  for (const team of teams) {
    statsMap.set(team.id, {
      team_id: team.id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  // Process each match
  for (const match of matches) {
    const result = resultMap.get(match.id);
    if (!result) {
      // Match has no result yet, skip
      continue;
    }

    const team1Stats = statsMap.get(match.team1_id);
    const team2Stats = statsMap.get(match.team2_id);

    if (!team1Stats || !team2Stats) {
      // One or both teams not found, skip
      continue;
    }

    // Update stats
    team1Stats.played++;
    team2Stats.played++;

    team1Stats.goalsFor += result.team1_score;
    team1Stats.goalsAgainst += result.team2_score;
    team1Stats.goalDifference = team1Stats.goalsFor - team1Stats.goalsAgainst;

    team2Stats.goalsFor += result.team2_score;
    team2Stats.goalsAgainst += result.team1_score;
    team2Stats.goalDifference = team2Stats.goalsFor - team2Stats.goalsAgainst;

    // Update points and wins/draws/losses
    if (result.team1_score > result.team2_score) {
      team1Stats.wins++;
      team1Stats.points += 3;
      team2Stats.losses++;
      team2Stats.points += 0;
    } else if (result.team2_score > result.team1_score) {
      team2Stats.wins++;
      team2Stats.points += 3;
      team1Stats.losses++;
      team1Stats.points += 0;
    } else {
      // Draw
      team1Stats.draws++;
      team1Stats.points += 1;
      team2Stats.draws++;
      team2Stats.points += 1;
    }
  }

  // Convert map to array
  let standings = Array.from(statsMap.values());

  // Sort with tiebreakers
  const sortedResult = applyTiebreakers(standings, matches, resultMap);

  return {
    group_code: teams[0]?.group_code || '',
    standings: sortedResult.standings,
    requiresManualTiebreak: sortedResult.requiresManualTiebreak,
    tiedTeams: sortedResult.tiedTeams,
  };
}

/**
 * Apply tiebreakers to sort standings
 */
interface TiebreakResult {
  standings: TeamStats[];
  requiresManualTiebreak: boolean;
  tiedTeams: string[];
}

function applyTiebreakers(
  standings: TeamStats[],
  matches: Match[],
  resultMap: Map<string, MatchResult>
): TiebreakResult {
  // First, sort by points (descending), then goal difference, then goals for
  let sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  // Find groups of tied teams (same points)
  const tiedGroups = findTiedGroups(sorted);

  // For each tied group, apply head-to-head tiebreakers
  let requiresManualTiebreak = false;
  const allTiedTeams: string[] = [];

  for (const tiedGroup of tiedGroups) {
    if (tiedGroup.length <= 1) continue;

    const tiebreakResult = resolveTiebreak(tiedGroup, matches, resultMap);
    if (tiebreakResult.requiresManualTiebreak) {
      requiresManualTiebreak = true;
      allTiedTeams.push(...tiebreakResult.tiedTeams);
    }

    // Update the sorted array with the resolved order
    // Find the indices of the tied teams in the sorted array
    const indices = tiedGroup.map((team) => sorted.findIndex((s) => s.team_id === team.team_id));
    const startIndex = Math.min(...indices);

    // Replace the tied teams with the resolved order
    const resolved = tiebreakResult.resolved;
    for (let i = 0; i < resolved.length; i++) {
      sorted[startIndex + i] = resolved[i];
    }
  }

  return {
    standings: sorted,
    requiresManualTiebreak,
    tiedTeams: allTiedTeams,
  };
}

/**
 * Find groups of teams with the same points
 */
function findTiedGroups(standings: TeamStats[]): TeamStats[][] {
  const groups: TeamStats[][] = [];
  let currentGroup: TeamStats[] = [];

  for (let i = 0; i < standings.length; i++) {
    if (currentGroup.length === 0) {
      currentGroup.push(standings[i]);
    } else {
      const lastPoints = currentGroup[0].points;
      if (standings[i].points === lastPoints) {
        currentGroup.push(standings[i]);
      } else {
        if (currentGroup.length > 1) {
          groups.push(currentGroup);
        }
        currentGroup = [standings[i]];
      }
    }
  }

  if (currentGroup.length > 1) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Resolve tiebreak for a group of tied teams
 * Handles 2+ team ties with proper multi-team head-to-head logic
 */
interface TiebreakResolution {
  resolved: TeamStats[];
  requiresManualTiebreak: boolean;
  tiedTeams: string[];
}

function resolveTiebreak(
  tiedTeams: TeamStats[],
  matches: Match[],
  resultMap: Map<string, MatchResult>
): TiebreakResolution {
  const teamIds = new Set(tiedTeams.map((t) => t.team_id));

  // Calculate head-to-head stats for tied teams
  const h2hStats = calculateHeadToHeadStats(tiedTeams, matches, resultMap, teamIds);

  let resolved = [...tiedTeams];

  // Apply tiebreak criteria sequentially
  // For multi-team ties, we apply each criterion to the entire tied group
  // If a criterion partially separates teams, the separated teams are fixed
  // and remaining criteria apply only to still-tied subgroups

  // 1. Points in matches between tied teams
  resolved.sort((a, b) => {
    const aH2h = h2hStats.get(a.team_id)!;
    const bH2h = h2hStats.get(b.team_id)!;
    return bH2h.points - aH2h.points;
  });

  // Check if fully resolved
  if (isFullyResolved(resolved)) {
    return { resolved, requiresManualTiebreak: false, tiedTeams: [] };
  }

  // Find still-tied subgroups after H2H points
  let tiedGroups = findTiedGroups(resolved);

  // 2. Goal difference in matches between tied teams
  // Apply only to still-tied subgroups
  for (const group of tiedGroups) {
    if (group.length > 1) {
      group.sort((a, b) => {
        const aH2h = h2hStats.get(a.team_id)!;
        const bH2h = h2hStats.get(b.team_id)!;
        return bH2h.goalDifference - aH2h.goalDifference;
      });
    }
  }

  // Reconstruct the full array with sorted subgroups
  resolved = reconstructSortedArray(resolved, tiedGroups);

  // Check if fully resolved
  if (isFullyResolved(resolved)) {
    return { resolved, requiresManualTiebreak: false, tiedTeams: [] };
  }

  // Find still-tied subgroups after H2H GD
  tiedGroups = findTiedGroups(resolved);

  // 3. Goals scored in matches between tied teams
  for (const group of tiedGroups) {
    if (group.length > 1) {
      group.sort((a, b) => {
        const aH2h = h2hStats.get(a.team_id)!;
        const bH2h = h2hStats.get(b.team_id)!;
        return bH2h.goalsFor - aH2h.goalsFor;
      });
    }
  }

  // Reconstruct the full array
  resolved = reconstructSortedArray(resolved, tiedGroups);

  // Check if fully resolved
  if (isFullyResolved(resolved)) {
    return { resolved, requiresManualTiebreak: false, tiedTeams: [] };
  }

  // Find still-tied subgroups after H2H goals
  tiedGroups = findTiedGroups(resolved);

  // 4. Total goal difference (apply to still-tied subgroups)
  for (const group of tiedGroups) {
    if (group.length > 1) {
      group.sort((a, b) => b.goalDifference - a.goalDifference);
    }
  }

  // Reconstruct the full array
  resolved = reconstructSortedArray(resolved, tiedGroups);

  // Check if fully resolved
  if (isFullyResolved(resolved)) {
    return { resolved, requiresManualTiebreak: false, tiedTeams: [] };
  }

  // Find still-tied subgroups after total GD
  tiedGroups = findTiedGroups(resolved);

  // 5. Total goals scored (apply to still-tied subgroups)
  for (const group of tiedGroups) {
    if (group.length > 1) {
      group.sort((a, b) => b.goalsFor - a.goalsFor);
    }
  }

  // Reconstruct the full array
  resolved = reconstructSortedArray(resolved, tiedGroups);

  // After all criteria, check if still tied
  const finalTiedGroups = findTiedGroups(resolved);
  const finalTiedTeams: string[] = [];
  for (const group of finalTiedGroups) {
    if (group.length > 1) {
      finalTiedTeams.push(...group.map((t) => t.team_id));
    }
  }

  return {
    resolved,
    requiresManualTiebreak: finalTiedTeams.length > 0,
    tiedTeams: finalTiedTeams,
  };
}

/**
 * Reconstruct the full sorted array from sorted subgroups
 * Preserves the order of separated teams and inserts sorted subgroups
 */
function reconstructSortedArray(
  original: TeamStats[],
  tiedGroups: TeamStats[][]
): TeamStats[] {
  if (tiedGroups.length === 0) {
    return [...original];
  }

  // Create a map of team_id to index in original
  const indexMap = new Map<string, number>();
  original.forEach((team, idx) => {
    indexMap.set(team.team_id, idx);
  });

  // For each tied group, find their positions in the original array
  // and replace them with the sorted version
  const result = [...original];

  for (const group of tiedGroups) {
    if (group.length <= 1) continue;

    // Find the range of indices this group occupies in the original array
    const indices = group.map((team) => indexMap.get(team.team_id)!).sort((a, b) => a - b);
    const startIndex = indices[0];
    const endIndex = indices[indices.length - 1];

    // Replace the range with the sorted group
    result.splice(startIndex, endIndex - startIndex + 1, ...group);
  }

  return result;
}

/**
 * Calculate head-to-head stats for a subset of teams
 */
interface H2HStats {
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

function calculateHeadToHeadStats(
  teams: TeamStats[],
  matches: Match[],
  resultMap: Map<string, MatchResult>,
  teamIds: Set<string>
): Map<string, H2HStats> {
  const stats = new Map<string, H2HStats>();

  // Initialize
  for (const team of teams) {
    stats.set(team.team_id, {
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
    });
  }

  // Process only matches between tied teams
  for (const match of matches) {
    const isTeam1InSet = teamIds.has(match.team1_id);
    const isTeam2InSet = teamIds.has(match.team2_id);

    if (!isTeam1InSet || !isTeam2InSet) {
      // Not a match between tied teams
      continue;
    }

    const result = resultMap.get(match.id);
    if (!result) continue;

    const team1Stats = stats.get(match.team1_id);
    const team2Stats = stats.get(match.team2_id);

    if (!team1Stats || !team2Stats) continue;

    team1Stats.goalsFor += result.team1_score;
    team1Stats.goalsAgainst += result.team2_score;
    team1Stats.goalDifference = team1Stats.goalsFor - team1Stats.goalsAgainst;

    team2Stats.goalsFor += result.team2_score;
    team2Stats.goalsAgainst += result.team1_score;
    team2Stats.goalDifference = team2Stats.goalsFor - team2Stats.goalsAgainst;

    if (result.team1_score > result.team2_score) {
      team1Stats.points += 3;
    } else if (result.team2_score > result.team1_score) {
      team2Stats.points += 3;
    } else {
      team1Stats.points += 1;
      team2Stats.points += 1;
    }
  }

  return stats;
}

/**
 * Check if all teams have unique positions (no ties)
 */
function isFullyResolved(standings: TeamStats[]): boolean {
  for (let i = 0; i < standings.length - 1; i++) {
    const current = standings[i];
    const next = standings[i + 1];

    if (current.points === next.points &&
        current.goalDifference === next.goalDifference &&
        current.goalsFor === next.goalsFor) {
      return false;
    }
  }
  return true;
}
