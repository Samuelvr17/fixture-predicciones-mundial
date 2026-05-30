/**
 * Pure TypeScript engine for resolving the global official bracket
 * No database connections, no React components
 * 
 * This module resolves knockout stage teams from:
 * - Group standings (1A, 2A, etc.)
 * - Best third-place teams (3A/B/C/D/F, etc.)
 * - Previous match results (W74, L101, etc.)
 * 
 * The engine degrades gracefully when data is incomplete or thirdPlaceAssignment.ts
 * is not yet fully populated.
 */

import {
  areAllGroupsComplete,
  areAllGroupsResolved,
  isGroupComplete,
  GroupStandingsOutput,
  TeamStats,
} from './groupStandings';
import { BestThirdsOutput } from './bestThirds';
import { assignThirdPlaceSlots, SlotPattern, hasCombination } from './thirdPlaceAssignment';

// Re-export types for convenience
export type { GroupStandingsOutput, TeamStats } from './groupStandings';
export type { BestThirdsOutput } from './bestThirds';

// ============================================================================
// TYPES
// ============================================================================

export type GroupCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export type Slot = 
  | `${number}${GroupCode}` // 1A, 2A, etc.
  | `3${string}` // 3A/B/C/D/F, etc.
  | `W${number}` // W74, W75, etc.
  | `L${number}`; // L101, L102, etc.

export type Round = 
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final';

export interface Match {
  id: string;
  num?: number; // Official match number (73-88 for round of 32, etc.)
  round: Round;
  date: string;
  time: string;
  ground: string;
  team1_id?: string;
  team2_id?: string;
  team1_slot?: Slot;
  team2_slot?: Slot;
}

export interface MatchResult {
  match_id: string;
  team1_score: number;
  team2_score: number;
  winner_team_id?: string; // For knockout stages, who advances
}

export interface ManualTiebreak {
  type: 'group' | 'best_thirds';
  reference: string;
  ordered_team_ids: string[];
}

export interface PendingSlot {
  slot: Slot;
  reason: 'missing_standings' | 'incomplete_group' | 'unresolved_tiebreak' | 'missing_best_thirds' | 'missing_third_place_assignment' | 'missing_match_result' | 'invalid_slot';
}

export interface ResolvedMatch {
  match: Match;
  team1_id?: string;
  team2_id?: string;
  team1_slot?: Slot;
  team2_slot?: Slot;
  winner_team_id?: string;
  loser_team_id?: string;
  pendingSlots: PendingSlot[];
}

export interface BracketOutput {
  matches: ResolvedMatch[];
  champion?: string; // team_id
  thirdPlace?: string; // team_id
  pendingSlots: PendingSlot[];
  complete: boolean; // true if all slots resolved and final has winner
}

export interface ResolveBracketOptions {
  /**
   * When true, group-derived slots are resolved only after official group
   * standings are complete and tiebreaks are settled. Predicted brackets can
   * disable this to keep rendering a user's hypothetical bracket path.
   */
  requireOfficialGroupResolution?: boolean;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Resolve the global official bracket from standings, results, and match data
 * 
 * @param matches - All knockout stage matches
 * @param matchResults - Official match results
 * @param groupStandings - Calculated group standings
 * @param bestThirds - Calculated best third-place teams
 * @param manualTiebreaks - Optional manual tiebreak resolutions
 * @returns Resolved bracket with teams, winners, and pending slots
 */
export function resolveBracket(
  matches: Match[],
  matchResults: MatchResult[],
  groupStandings: GroupStandingsOutput,
  bestThirds: BestThirdsOutput,
  manualTiebreaks?: ManualTiebreak[],
  options: ResolveBracketOptions = {}
): BracketOutput {
  const requireOfficialGroupResolution = options.requireOfficialGroupResolution ?? true;
  // Create lookup maps
  const matchMap = new Map<string, Match>();
  for (const match of matches) {
    matchMap.set(match.id, match);
  }

  const resultMap = new Map<string, MatchResult>();
  for (const result of matchResults) {
    resultMap.set(result.match_id, result);
  }

  const manualTiebreakMap = new Map<string, ManualTiebreak>();
  if (manualTiebreaks) {
    for (const tiebreak of manualTiebreaks) {
      manualTiebreakMap.set(tiebreak.reference, tiebreak);
    }
  }

  // Resolve matches in order (round of 32 first, then round of 16, etc.)
  const sortedMatches = sortMatchesByRound(matches);
  
  const resolvedMatches: ResolvedMatch[] = [];
  const allPendingSlots: PendingSlot[] = [];

  // Track resolved teams for W/L slots
  const matchWinners = new Map<number, string>(); // match_num -> winner_team_id
  const matchLosers = new Map<number, string>(); // match_num -> loser_team_id

  for (const match of sortedMatches) {
    const result = resultMap.get(match.id);
    
    // Resolve team1
    const team1Result = resolveSlot(
      match.team1_slot,
      match.team1_id,
      groupStandings,
      bestThirds,
      matchWinners,
      matchLosers,
      manualTiebreakMap,
      requireOfficialGroupResolution
    );

    // Resolve team2
    const team2Result = resolveSlot(
      match.team2_slot,
      match.team2_id,
      groupStandings,
      bestThirds,
      matchWinners,
      matchLosers,
      manualTiebreakMap,
      requireOfficialGroupResolution
    );

    const pendingSlots = [...team1Result.pendingSlots, ...team2Result.pendingSlots];
    allPendingSlots.push(...pendingSlots);

    // Determine winner and loser if result exists
    let winner_team_id: string | undefined;
    let loser_team_id: string | undefined;

    if (result) {
      winner_team_id = result.winner_team_id;
      
      // If winner_team_id is not explicitly set, infer from score
      if (!winner_team_id) {
        if (result.team1_score > result.team2_score) {
          winner_team_id = team1Result.team_id;
          loser_team_id = team2Result.team_id;
        } else if (result.team2_score > result.team1_score) {
          winner_team_id = team2Result.team_id;
          loser_team_id = team1Result.team_id;
        }
        // If draw, winner must be set manually in winner_team_id
      } else {
        // winner_team_id is set, determine loser
        loser_team_id = winner_team_id === team1Result.team_id ? team2Result.team_id : team1Result.team_id;
      }

      // Store winner/loser for future W/L slot resolution
      if (match.num && winner_team_id) {
        matchWinners.set(match.num, winner_team_id);
      }
      if (match.num && loser_team_id) {
        matchLosers.set(match.num, loser_team_id);
      }
    }

    resolvedMatches.push({
      match,
      team1_id: team1Result.team_id || match.team1_id,
      team2_id: team2Result.team_id || match.team2_id,
      team1_slot: team1Result.team_id ? undefined : match.team1_slot,
      team2_slot: team2Result.team_id ? undefined : match.team2_slot,
      winner_team_id,
      loser_team_id,
      pendingSlots,
    });
  }

  // Determine champion and third place
  let champion: string | undefined;
  let thirdPlace: string | undefined;

  const finalMatch = resolvedMatches.find(m => m.match.round === 'final');
  if (finalMatch?.winner_team_id) {
    champion = finalMatch.winner_team_id;
  }

  const thirdPlaceMatch = resolvedMatches.find(m => m.match.round === 'third_place');
  if (thirdPlaceMatch?.winner_team_id) {
    thirdPlace = thirdPlaceMatch.winner_team_id;
  }

  const complete = !!champion && allPendingSlots.length === 0;

  return {
    matches: resolvedMatches,
    champion,
    thirdPlace,
    pendingSlots: allPendingSlots,
    complete,
  };
}

// ============================================================================
// SLOT RESOLUTION
// ============================================================================

interface SlotResolution {
  team_id?: string;
  pendingSlots: PendingSlot[];
}

function resolveSlot(
  slot: Slot | undefined,
  existingTeamId: string | undefined,
  groupStandings: GroupStandingsOutput,
  bestThirds: BestThirdsOutput,
  matchWinners: Map<number, string>,
  matchLosers: Map<number, string>,
  manualTiebreaks: Map<string, ManualTiebreak>,
  requireOfficialGroupResolution: boolean
): SlotResolution {
  // If team is already set, use it
  if (existingTeamId) {
    return { team_id: existingTeamId, pendingSlots: [] };
  }

  if (!slot) {
    return { team_id: undefined, pendingSlots: [] };
  }

  // Parse slot type
  if (slot.match(/^\d[A-L]$/)) {
    // Group position: 1A, 2A, etc.
    return resolveGroupPositionSlot(slot, groupStandings, manualTiebreaks, requireOfficialGroupResolution);
  } else if (slot.startsWith('3')) {
    // Third place: 3A/B/C/D/F, etc.
    return resolveThirdPlaceSlot(slot, bestThirds, groupStandings, requireOfficialGroupResolution);
  } else if (slot.startsWith('W')) {
    // Winner: W74, W75, etc.
    return resolveWinnerSlot(slot, matchWinners);
  } else if (slot.startsWith('L')) {
    // Loser: L101, L102, etc.
    return resolveLoserSlot(slot, matchLosers);
  }

  return {
    team_id: undefined,
    pendingSlots: [{ slot, reason: 'invalid_slot' }],
  };
}

function resolveGroupPositionSlot(
  slot: Slot,
  groupStandings: GroupStandingsOutput,
  manualTiebreaks: Map<string, ManualTiebreak>,
  requireOfficialGroupResolution: boolean
): SlotResolution {
  const position = parseInt(slot[0]); // 1 or 2
  const groupCode = slot[1] as GroupCode; // A, B, etc.

  const groupStanding = groupStandings.standings[groupCode];
  
  if (!groupStanding) {
    return {
      team_id: undefined,
      pendingSlots: [{ slot, reason: 'missing_standings' }],
    };
  }

  if (requireOfficialGroupResolution) {
    if (!isGroupComplete(groupStanding)) {
      return {
        team_id: undefined,
        pendingSlots: [{ slot, reason: 'incomplete_group' }],
      };
    }

    if (groupStanding.requiresManualTiebreak) {
      return {
        team_id: undefined,
        pendingSlots: [{ slot, reason: 'unresolved_tiebreak' }],
      };
    }
  }

  const index = position - 1; // 0-indexed
  const teamStats = groupStanding.standings[index];

  if (!teamStats) {
    return {
      team_id: undefined,
      pendingSlots: [{ slot, reason: 'missing_standings' }],
    };
  }

  return { team_id: teamStats.team_id, pendingSlots: [] };
}

function resolveThirdPlaceSlot(
  slot: Slot,
  bestThirds: BestThirdsOutput,
  groupStandings: GroupStandingsOutput,
  requireOfficialGroupResolution: boolean
): SlotResolution {
  // Third-place slots are official only after all groups are complete and
  // any group/best-thirds tiebreaks have been resolved.
  if (requireOfficialGroupResolution) {
    if (!areAllGroupsComplete(groupStandings)) {
      return {
        team_id: undefined,
        pendingSlots: [{ slot, reason: 'incomplete_group' }],
      };
    }

    if (!areAllGroupsResolved(groupStandings) || bestThirds.requiresManualTiebreak) {
      return {
        team_id: undefined,
        pendingSlots: [{ slot, reason: 'unresolved_tiebreak' }],
      };
    }
  }

  // Check if best thirds are calculated
  if (bestThirds.pending || bestThirds.qualifiedThirds.length === 0) {
    return {
      team_id: undefined,
      pendingSlots: [{ slot, reason: 'missing_best_thirds' }],
    };
  }

  // Extract the slot pattern (e.g., "3A/B/C/D/F")
  const slotPattern = slot as SlotPattern;

  // Get the qualified group codes
  const qualifiedGroupCodes = bestThirds.qualifiedThirds.map(t => {
    // Find which group this team is from
    for (const groupCode in groupStandings.standings) {
      const group = groupStandings.standings[groupCode];
      const team = group.standings.find(s => s.team_id === t.team_id);
      if (team) {
        return groupCode;
      }
    }
    return '';
  }).filter(Boolean) as GroupCode[];

  // Check if this combination exists in thirdPlaceAssignment.ts
  if (!hasCombination(qualifiedGroupCodes)) {
    // Third place assignment table is incomplete
    // Don't throw fatal error - return pending with specific reason
    return {
      team_id: undefined,
      pendingSlots: [{ slot, reason: 'missing_third_place_assignment' }],
    };
  }

  // Try to resolve using thirdPlaceAssignment.ts
  try {
    const assignment = assignThirdPlaceSlots(qualifiedGroupCodes);
    const assignedGroupCode = assignment.assignments[slotPattern];

    if (!assignedGroupCode) {
      return {
        team_id: undefined,
        pendingSlots: [{ slot, reason: 'missing_third_place_assignment' }],
      };
    }

    // Find the team_id for this group's third place
    const groupStanding = groupStandings.standings[assignedGroupCode];
    if (!groupStanding || groupStanding.standings.length < 3) {
      return {
        team_id: undefined,
        pendingSlots: [{ slot, reason: 'missing_standings' }],
      };
    }

    const thirdPlaceTeam = groupStanding.standings[2]; // Index 2 is third place
    return { team_id: thirdPlaceTeam.team_id, pendingSlots: [] };
  } catch (error) {
    // If assignThirdPlaceSlots throws, treat as missing assignment
    return {
      team_id: undefined,
      pendingSlots: [{ slot, reason: 'missing_third_place_assignment' }],
    };
  }
}

function resolveWinnerSlot(
  slot: Slot,
  matchWinners: Map<number, string>
): SlotResolution {
  const matchNum = parseInt(slot.substring(1)); // Extract number from W74

  const winner = matchWinners.get(matchNum);

  if (!winner) {
    return {
      team_id: undefined,
      pendingSlots: [{ slot, reason: 'missing_match_result' }],
    };
  }

  return { team_id: winner, pendingSlots: [] };
}

function resolveLoserSlot(
  slot: Slot,
  matchLosers: Map<number, string>
): SlotResolution {
  const matchNum = parseInt(slot.substring(1)); // Extract number from L101

  const loser = matchLosers.get(matchNum);

  if (!loser) {
    return {
      team_id: undefined,
      pendingSlots: [{ slot, reason: 'missing_match_result' }],
    };
  }

  return { team_id: loser, pendingSlots: [] };
}

// ============================================================================
// HELPERS
// ============================================================================

function sortMatchesByRound(matches: Match[]): Match[] {
  const roundOrder: Record<Round, number> = {
    'round_of_32': 1,
    'round_of_16': 2,
    'quarter_final': 3,
    'semi_final': 4,
    'third_place': 5,
    'final': 6,
  };

  return [...matches].sort((a, b) => {
    const orderA = roundOrder[a.round];
    const orderB = roundOrder[b.round];
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Within same round, sort by match number if available
    if (a.num !== undefined && b.num !== undefined) {
      return a.num - b.num;
    }

    return 0;
  });
}
