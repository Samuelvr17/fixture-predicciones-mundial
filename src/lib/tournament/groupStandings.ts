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

export interface ManualTiebreak {
  type: 'group';
  reference: string; // e.g., 'group_A', 'group_B', etc.
  ordered_team_ids: string[];
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
  results: MatchResult[],
  manualTiebreaks?: ManualTiebreak[]
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
    
    // Check if there's a manual tiebreak for this group
    const groupReference = `group_${groupCode}`;
    const manualTiebreak = manualTiebreaks?.find(tb => tb.reference === groupReference);
    
    if (manualTiebreak) {
      // Apply manual tiebreak only within the tied block
      const adjustedStandings = applyManualTiebreakToStandings(
        groupResult.standings,
        manualTiebreak,
        groupResult.tiedTeams
      );

      // Check if there are still tied teams that were NOT in the manual tiebreak
      // (there might be other tied blocks that weren't resolved)
      const manualTiebreakTeamIds = new Set(manualTiebreak.ordered_team_ids);
      const stillTiedTeams = groupResult.tiedTeams.filter(
        teamId => !manualTiebreakTeamIds.has(teamId)
      );

      standings[groupCode] = {
        ...groupResult,
        standings: adjustedStandings,
        requiresManualTiebreak: stillTiedTeams.length > 0,
        tiedTeams: stillTiedTeams,
      };
    } else {
      standings[groupCode] = groupResult;
    }

    if (standings[groupCode].requiresManualTiebreak) {
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
 *
 * Tiebreak criteria (in order):
 * 1. Points in matches between tied teams (head-to-head)
 * 2. Goal difference in matches between tied teams (head-to-head)
 * 3. Goals scored in matches between tied teams (head-to-head)
 * 4. Total goal difference (all matches)
 * 5. Total goals scored (all matches)
 * 6. If still tied: requires manual tiebreak by global_admin
 *
 * NOTE: Fair play and FIFA ranking criteria have been removed.
 * They are replaced by manual resolution from global_admin when automatic criteria fail.
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
  const resolution = resolveTiedBlock(tiedTeams, matches, resultMap, 0);

  return {
    resolved: resolution.resolved,
    requiresManualTiebreak: resolution.tiedTeams.length > 0,
    tiedTeams: resolution.tiedTeams,
  };
}

interface BlockResolution {
  resolved: TeamStats[];
  tiedTeams: string[];
}

type TiebreakCriterion =
  | 'headToHeadPoints'
  | 'headToHeadGoalDifference'
  | 'headToHeadGoalsFor'
  | 'totalGoalDifference'
  | 'totalGoalsFor';

const TIEBREAK_CRITERIA: TiebreakCriterion[] = [
  'headToHeadPoints',
  'headToHeadGoalDifference',
  'headToHeadGoalsFor',
  'totalGoalDifference',
  'totalGoalsFor',
];

/**
 * Resolve one tied block criterion by criterion.
 *
 * Each criterion sorts the current unresolved block and splits it into smaller
 * equal-value sub-blocks. Teams (or sub-blocks) already separated by an earlier
 * criterion keep their relative ranking, and the next criterion is applied only
 * to the sub-blocks that remain tied.
 */
function resolveTiedBlock(
  block: TeamStats[],
  matches: Match[],
  resultMap: Map<string, MatchResult>,
  criterionIndex: number
): BlockResolution {
  if (block.length <= 1) {
    return { resolved: block, tiedTeams: [] };
  }

  if (criterionIndex >= TIEBREAK_CRITERIA.length) {
    return {
      resolved: block,
      tiedTeams: block.map((team) => team.team_id),
    };
  }

  const criterion = TIEBREAK_CRITERIA[criterionIndex];
  const h2hStats = criterion.startsWith('headToHead')
    ? calculateHeadToHeadStats(
        block,
        matches,
        resultMap,
        new Set(block.map((team) => team.team_id))
      )
    : undefined;
  const inheritedOrder = new Map(block.map((team, index) => [team.team_id, index]));

  const sorted = [...block].sort((a, b) => {
    const diff =
      getCriterionValue(b, criterion, h2hStats) - getCriterionValue(a, criterion, h2hStats);
    if (diff !== 0) return diff;

    // Stable tie: preserve the order inherited from previous criteria.
    return inheritedOrder.get(a.team_id)! - inheritedOrder.get(b.team_id)!;
  });

  const equalValueBlocks = splitByCriterionValue(sorted, criterion, h2hStats);
  const resolved: TeamStats[] = [];
  const tiedTeams: string[] = [];

  for (const equalValueBlock of equalValueBlocks) {
    if (equalValueBlock.length === 1) {
      resolved.push(equalValueBlock[0]);
      continue;
    }

    const subResolution = resolveTiedBlock(
      equalValueBlock,
      matches,
      resultMap,
      criterionIndex + 1
    );

    resolved.push(...subResolution.resolved);
    tiedTeams.push(...subResolution.tiedTeams);
  }

  return { resolved, tiedTeams };
}

function getCriterionValue(
  team: TeamStats,
  criterion: TiebreakCriterion,
  h2hStats?: Map<string, H2HStats>
): number {
  switch (criterion) {
    case 'headToHeadPoints':
      return h2hStats?.get(team.team_id)?.points ?? 0;
    case 'headToHeadGoalDifference':
      return h2hStats?.get(team.team_id)?.goalDifference ?? 0;
    case 'headToHeadGoalsFor':
      return h2hStats?.get(team.team_id)?.goalsFor ?? 0;
    case 'totalGoalDifference':
      return team.goalDifference;
    case 'totalGoalsFor':
      return team.goalsFor;
  }
}

function splitByCriterionValue(
  sorted: TeamStats[],
  criterion: TiebreakCriterion,
  h2hStats?: Map<string, H2HStats>
): TeamStats[][] {
  const blocks: TeamStats[][] = [];
  let currentBlock: TeamStats[] = [];
  let currentValue: number | null = null;

  for (const team of sorted) {
    const value = getCriterionValue(team, criterion, h2hStats);

    if (currentBlock.length === 0 || value === currentValue) {
      currentBlock.push(team);
      currentValue = value;
    } else {
      blocks.push(currentBlock);
      currentBlock = [team];
      currentValue = value;
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks;
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
 * Apply manual tiebreak order to group standings
 * Only reorders teams within the tied block, never globally
 * Teams with more points cannot be overtaken by teams with fewer points
 */
function applyManualTiebreakToStandings(
  standings: TeamStats[],
  manualTiebreak: ManualTiebreak,
  tiedTeams: string[]
): TeamStats[] {
  if (!tiedTeams || tiedTeams.length === 0) {
    return standings;
  }

  const tiedTeamIds = new Set(tiedTeams);
  const result = [...standings];
  const tiedBlocks = findContiguousTiedBlocks(standings, tiedTeamIds);

  for (const block of tiedBlocks) {
    const sortedBlock = sortBlockByManualOrder(
      block.teams,
      manualTiebreak.ordered_team_ids
    );
    result.splice(block.startIndex, sortedBlock.length, ...sortedBlock);
  }

  return result;
}

function findContiguousTiedBlocks(
  standings: TeamStats[],
  tiedTeamIds: Set<string>
): Array<{ startIndex: number; teams: TeamStats[] }> {
  const blocks: Array<{ startIndex: number; teams: TeamStats[] }> = [];
  let currentBlock: TeamStats[] = [];
  let currentStartIndex = 0;

  standings.forEach((team, index) => {
    if (tiedTeamIds.has(team.team_id)) {
      if (currentBlock.length === 0) {
        currentStartIndex = index;
      }
      currentBlock.push(team);
      return;
    }

    if (currentBlock.length > 0) {
      blocks.push({ startIndex: currentStartIndex, teams: currentBlock });
      currentBlock = [];
    }
  });

  if (currentBlock.length > 0) {
    blocks.push({ startIndex: currentStartIndex, teams: currentBlock });
  }

  return blocks;
}

function sortBlockByManualOrder(
  block: TeamStats[],
  orderedTeamIds: string[]
): TeamStats[] {
  const manualOrderMap = new Map<string, number>();
  orderedTeamIds.forEach((teamId, index) => {
    manualOrderMap.set(teamId, index);
  });
  const originalOrderMap = new Map(block.map((team, index) => [team.team_id, index]));

  return [...block].sort((a, b) => {
    const aInManual = manualOrderMap.has(a.team_id);
    const bInManual = manualOrderMap.has(b.team_id);

    if (aInManual && bInManual) {
      return manualOrderMap.get(a.team_id)! - manualOrderMap.get(b.team_id)!;
    }

    if (aInManual) return -1;
    if (bInManual) return 1;

    return originalOrderMap.get(a.team_id)! - originalOrderMap.get(b.team_id)!;
  });
}
