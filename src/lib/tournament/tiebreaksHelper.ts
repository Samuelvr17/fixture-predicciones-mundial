/**
 * Pure helper functions for calculating tiebreak data
 * Extracted from TiebreaksClient for testability
 */

import { calculateGroupStandings, type Team, type Match, type MatchResult, type ManualTiebreak as GroupManualTiebreak } from './groupStandings';
import { calculateBestThirds, type ManualTiebreak as BestThirdsManualTiebreak } from './bestThirds';
import { normalizeManualTiebreaksFromDb, separateTiebreaksByType, type DbManualTiebreak } from './manualTiebreaks';

// ============================================================================
// TYPES
// ============================================================================

export interface TeamData {
  id: string;
  name: string;
  display_name_es?: string | null;
  code: string;
  group_code: string | null;
}

export interface MatchData {
  id: string;
  team1_id: string | null;
  team2_id: string | null;
  group_code: string | null;
}

export interface MatchResultData {
  match_id: string;
  team1_score: number;
  team2_score: number;
}

export interface GroupTiebreakData {
  groupCode: string;
  tiedTeams: Array<{
    id: string;
    name: string;
    display_name_es?: string | null;
    code: string;
    points: number;
    goalDifference: number;
    goalsFor: number;
    realPosition: number;
  }>;
  fullStandings: any[];
  existingResolution: string[] | null;
  resolved: boolean;
}

export interface BestThirdsTiebreakData {
  tiedTeams: Array<{
    id: string;
    name: string;
    display_name_es?: string | null;
    code: string;
    points: number;
    goalDifference: number;
    goalsFor: number;
    position: number;
    isCritical: boolean;
  }>;
  existingResolution: string[] | null;
  resolved: boolean;
}

export interface TiebreaksCalculationOutput {
  groupTiebreaks: Record<string, GroupTiebreakData>;
  bestThirdsTiebreak: BestThirdsTiebreakData | null;
}

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Calculate tiebreak data from raw database data
 * This is a pure function extracted from TiebreaksClient for testability
 */
export function calculateTiebreakData(
  teams: TeamData[],
  groupMatches: MatchData[],
  matchResults: MatchResultData[],
  manualTiebreaks: DbManualTiebreak[]
): TiebreaksCalculationOutput {
  // Convert data to engine format
  const teamMap = new Map<string, Team>();
  for (const team of teams) {
    if (team.group_code) {
      teamMap.set(team.id, {
        id: team.id,
        name: team.name,
        code: team.code,
        group_code: team.group_code,
      });
    }
  }

  const matchMap = new Map<string, Match>();
  for (const match of groupMatches) {
    if (match.team1_id && match.team2_id && match.group_code) {
      matchMap.set(match.id, {
        id: match.id,
        team1_id: match.team1_id,
        team2_id: match.team2_id,
        group_code: match.group_code,
        round: 'group',
      });
    }
  }

  const resultMap = new Map<string, MatchResult>();
  for (const result of matchResults) {
    resultMap.set(result.match_id, {
      match_id: result.match_id,
      team1_score: result.team1_score,
      team2_score: result.team2_score,
    });
  }

  // Normalize and separate manual tiebreaks
  const normalizedTiebreaks = normalizeManualTiebreaksFromDb(manualTiebreaks);
  const { groupTiebreaks, bestThirdsTiebreak } = separateTiebreaksByType(normalizedTiebreaks);

  // Calculate group standings
  const allTeams = Array.from(teamMap.values());
  const allMatches = Array.from(matchMap.values());
  const allResults = Array.from(resultMap.values());

  const groupStandingsOutput = calculateGroupStandings(allTeams, allMatches, allResults, groupTiebreaks);

  // Find groups requiring manual tiebreak
  const groupTiebreakData: Record<string, GroupTiebreakData> = {};
  for (const [groupCode, standings] of Object.entries(groupStandingsOutput.standings)) {
    if (standings.requiresManualTiebreak && standings.tiedTeams.length > 0) {
      // Check if already resolved
      const existing = manualTiebreaks.find(
        (t) => t.type === 'group_tiebreak' && t.reference === groupCode
      );

      const tiedTeamsData = standings.tiedTeams
        .map((teamId) => {
          const stats = standings.standings.find((s) => s.team_id === teamId);
          const team = teams.find((t) => t.id === teamId);
          if (!stats || !team) return null;
          // Calculate real position in the full standings
          const realPosition = standings.standings.findIndex((s) => s.team_id === teamId) + 1;
          return {
            id: team.id,
            name: team.name,
            display_name_es: team.display_name_es,
            code: team.code,
            points: stats.points,
            goalDifference: stats.goalDifference,
            goalsFor: stats.goalsFor,
            realPosition,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      groupTiebreakData[groupCode] = {
        groupCode,
        tiedTeams: tiedTeamsData,
        fullStandings: standings.standings,
        existingResolution: existing ? existing.ordered_team_ids : null,
        resolved: !!existing,
      };
    }
  }

  // Calculate best thirds
  let bestThirdsTiebreakData: BestThirdsTiebreakData | null = null;
  if (groupStandingsOutput.thirdPlaceTeams.length === 12) {
    const bestThirdsOutput = calculateBestThirds(
      groupStandingsOutput.thirdPlaceTeams,
      bestThirdsTiebreak
    );

    if (bestThirdsOutput.requiresManualTiebreak) {
      const tiedAtCutData = bestThirdsOutput.tiedAtCut
        .map((teamId) => {
          const stats = bestThirdsOutput.orderedThirds.find((s) => s.team_id === teamId);
          const team = teams.find((t) => t.id === teamId);
          if (!stats || !team) return null;
          const position = bestThirdsOutput.orderedThirds.findIndex((s) => s.team_id === teamId) + 1;
          return {
            id: team.id,
            name: team.name,
            display_name_es: team.display_name_es,
            code: team.code,
            points: stats.points,
            goalDifference: stats.goalDifference,
            goalsFor: stats.goalsFor,
            position,
            isCritical: position <= 8,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => a.position - b.position); // Sort by position to match /standings order

      bestThirdsTiebreakData = {
        tiedTeams: tiedAtCutData,
        existingResolution: bestThirdsTiebreak ? bestThirdsTiebreak.ordered_team_ids : null,
        resolved: !!bestThirdsTiebreak,
      };
    }
  }

  return {
    groupTiebreaks: groupTiebreakData,
    bestThirdsTiebreak: bestThirdsTiebreakData,
  };
}
