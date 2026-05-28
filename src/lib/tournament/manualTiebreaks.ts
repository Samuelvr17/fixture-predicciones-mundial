/**
 * Utility for normalizing manual tiebreaks from database format to engine format
 * 
 * Database format:
 * - type: 'group_tiebreak' or 'best_thirds'
 * - reference: for group_tiebreak it's just the group letter ('A'..'L'), for best_thirds it's 'best_thirds'
 * 
 * Engine format (groupStandings.ts):
 * - type: 'group'
 * - reference: 'group_A', 'group_B', etc. (with 'group_' prefix)
 * 
 * Engine format (bestThirds.ts):
 * - type: 'best_thirds'
 * - reference: 'best_thirds' (or similar)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DbManualTiebreak {
  id: string;
  type: 'group_tiebreak' | 'best_thirds';
  reference: string;
  ordered_team_ids: string[];
  resolved_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupManualTiebreak {
  type: 'group';
  reference: string; // e.g., 'group_A', 'group_B', etc.
  ordered_team_ids: string[];
}

export interface BestThirdsManualTiebreak {
  type: 'best_thirds';
  reference: string; // e.g., 'best_thirds'
  ordered_team_ids: string[];
}

export type EngineManualTiebreak = GroupManualTiebreak | BestThirdsManualTiebreak;

// ============================================================================
// NORMALIZATION FUNCTION
// ============================================================================

/**
 * Normalize manual tiebreaks from database format to engine format
 * 
 * @param manualTiebreaksFromDb - Array of manual tiebreaks from database
 * @returns Array of normalized manual tiebreaks in engine format
 */
export function normalizeManualTiebreaksFromDb(
  manualTiebreaksFromDb: DbManualTiebreak[]
): EngineManualTiebreak[] {
  const normalized: EngineManualTiebreak[] = [];

  for (const dbTiebreak of manualTiebreaksFromDb) {
    if (dbTiebreak.type === 'group_tiebreak') {
      // Convert group_tiebreak to group format
      // DB stores reference as 'A', 'B', etc.
      // Engine expects 'group_A', 'group_B', etc.
      const reference = dbTiebreak.reference.startsWith('group_')
        ? dbTiebreak.reference
        : `group_${dbTiebreak.reference}`;

      normalized.push({
        type: 'group',
        reference,
        ordered_team_ids: dbTiebreak.ordered_team_ids,
      });
    } else if (dbTiebreak.type === 'best_thirds') {
      // best_thirds format is already correct
      normalized.push({
        type: 'best_thirds',
        reference: dbTiebreak.reference,
        ordered_team_ids: dbTiebreak.ordered_team_ids,
      });
    }
  }

  return normalized;
}

/**
 * Normalize a single manual tiebreak from database format to engine format
 * 
 * @param dbTiebreak - Single manual tiebreak from database
 * @returns Normalized manual tiebreak in engine format, or null if type is unknown
 */
export function normalizeSingleManualTiebreakFromDb(
  dbTiebreak: DbManualTiebreak
): EngineManualTiebreak | null {
  if (dbTiebreak.type === 'group_tiebreak') {
    const reference = dbTiebreak.reference.startsWith('group_')
      ? dbTiebreak.reference
      : `group_${dbTiebreak.reference}`;

    return {
      type: 'group',
      reference,
      ordered_team_ids: dbTiebreak.ordered_team_ids,
    };
  } else if (dbTiebreak.type === 'best_thirds') {
    return {
      type: 'best_thirds',
      reference: dbTiebreak.reference,
      ordered_team_ids: dbTiebreak.ordered_team_ids,
    };
  }

  return null;
}

/**
 * Separate normalized tiebreaks by type
 * 
 * @param normalizedTiebreaks - Array of normalized manual tiebreaks
 * @returns Object with group tiebreaks and best thirds tiebreak separated
 */
export function separateTiebreaksByType(
  normalizedTiebreaks: EngineManualTiebreak[]
): {
  groupTiebreaks: GroupManualTiebreak[];
  bestThirdsTiebreak: BestThirdsManualTiebreak | undefined;
} {
  const groupTiebreaks: GroupManualTiebreak[] = [];
  let bestThirdsTiebreak: BestThirdsManualTiebreak | undefined;

  for (const tiebreak of normalizedTiebreaks) {
    if (tiebreak.type === 'group') {
      groupTiebreaks.push(tiebreak);
    } else if (tiebreak.type === 'best_thirds') {
      bestThirdsTiebreak = tiebreak;
    }
  }

  return { groupTiebreaks, bestThirdsTiebreak };
}
