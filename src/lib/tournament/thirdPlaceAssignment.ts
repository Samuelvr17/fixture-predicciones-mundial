/**
 * Pure TypeScript engine for assigning third-place teams to round of 32 slots
 * No database connections, no React components
 * 
 * This module resolves which third-place team goes to which slot when the fixture
 * has slots like 3A/B/C/D/F, 3C/D/F/G/H, etc.
 * 
 * The assignment follows the official FIFA World Cup 2026 rules, which define
 * a specific mapping based on which groups' third-place teams qualified.
 */

import annexCData from '../../data/annex-c-2026.json';

// ============================================================================
// TYPES
// ============================================================================

export type GroupCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export type FifaAnnexCColumn = '1A' | '1B' | '1D' | '1E' | '1G' | '1I' | '1K' | '1L';

export interface FifaAnnexCRow {
  option: number;
  '1A': GroupCode;
  '1B': GroupCode;
  '1D': GroupCode;
  '1E': GroupCode;
  '1G': GroupCode;
  '1I': GroupCode;
  '1K': GroupCode;
  '1L': GroupCode;
}

type AnnexCData = Record<string, FifaAnnexCRow>;

export type SlotPattern = 
  | '3A/B/C/D/F'
  | '3C/D/F/G/H'
  | '3C/E/F/H/I'
  | '3E/H/I/J/K'
  | '3B/E/F/I/J'
  | '3A/E/H/I/J'
  | '3E/F/G/I/J'
  | '3D/E/I/J/L';

export interface ThirdPlaceAssignment {
  slotPattern: SlotPattern;
  groupCode: GroupCode;
}

export interface ThirdPlaceAssignmentOutput {
  assignments: Record<SlotPattern, GroupCode>;
}

// ============================================================================
// OFFICIAL ASSIGNMENT TABLE
// ============================================================================

/**
 * Official FIFA World Cup 2026 third-place team assignment table.
 * 
 * This table maps each possible combination of 8 qualified third-place groups
 * to the specific slot each group should occupy in the round of 32.
 * 
 * The key is a sorted string of group codes (e.g., "ABCDEFGH").
 * The value is an array of assignments in the order of the slot patterns above.
 * 
 * Data is sourced from the official FIFA Annex C 2026 document.
 */
const OFFICIAL_ASSIGNMENT_TABLE: Record<string, GroupCode[]> = buildOfficialAssignmentTable();

/**
 * Converts a FIFA Annex C row to the internal SLOT_PATTERNS array order.
 * 
 * FIFA format columns map to internal slot patterns as follows:
 * - SLOT_PATTERNS[0] (3A/B/C/D/F) uses column "1E"
 * - SLOT_PATTERNS[1] (3C/D/F/G/H) uses column "1I"
 * - SLOT_PATTERNS[2] (3C/E/F/H/I) uses column "1A"
 * - SLOT_PATTERNS[3] (3E/H/I/J/K) uses column "1L"
 * - SLOT_PATTERNS[4] (3B/E/F/I/J) uses column "1D"
 * - SLOT_PATTERNS[5] (3A/E/H/I/J) uses column "1G"
 * - SLOT_PATTERNS[6] (3E/F/G/I/J) uses column "1B"
 * - SLOT_PATTERNS[7] (3D/E/I/J/L) uses column "1K"
 */
function convertFifaRowToSlotPatternArray(row: FifaAnnexCRow): GroupCode[] {
  return [
    row['1E'],
    row['1I'],
    row['1A'],
    row['1L'],
    row['1D'],
    row['1G'],
    row['1B'],
    row['1K'],
  ];
}

/**
 * Builds the official assignment table from FIFA Annex C data.
 * Performs defensive validation to ensure data integrity.
 */
function buildOfficialAssignmentTable(): Record<string, GroupCode[]> {
  const table: Record<string, GroupCode[]> = {};
  const data = annexCData as AnnexCData;
  const fifaColumns: FifaAnnexCColumn[] = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'];

  for (const [key, row] of Object.entries(data)) {
    // Validate row structure
    for (const col of fifaColumns) {
      if (!(col in row)) {
        throw new Error(`Invalid Annex C data: row "${key}" missing column "${col}"`);
      }
    }

    // Convert to internal order
    const slotPatternArray = convertFifaRowToSlotPatternArray(row);

    // Validate conversion produced 8 groups
    if (slotPatternArray.length !== 8) {
      throw new Error(`Invalid Annex C data: row "${key}" conversion produced ${slotPatternArray.length} groups, expected 8`);
    }

    // Validate no duplicates in converted array
    const uniqueGroups = new Set(slotPatternArray);
    if (uniqueGroups.size !== 8) {
      throw new Error(`Invalid Annex C data: row "${key}" has duplicate groups after conversion`);
    }

    // Validate converted groups match the key
    const sortedConverted = [...slotPatternArray].sort().join('');
    if (sortedConverted !== key) {
      throw new Error(`Invalid Annex C data: row "${key}" converted groups [${slotPatternArray.join(',')}] do not match key "${key}"`);
    }

    table[key] = slotPatternArray;
  }

  return table;
}

/**
 * Slot patterns in the order they appear in the assignment arrays
 */
const SLOT_PATTERNS: SlotPattern[] = [
  '3A/B/C/D/F',
  '3C/D/F/G/H',
  '3C/E/F/H/I',
  '3E/H/I/J/K',
  '3B/E/F/I/J',
  '3A/E/H/I/J',
  '3E/F/G/I/J',
  '3D/E/I/J/L',
];

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that the input is a valid list of 8 group codes
 */
function validateQualifiedGroups(groups: string[]): GroupCode[] {
  // Check exactly 8 groups
  if (groups.length !== 8) {
    throw new Error(
      `Expected exactly 8 qualified third-place groups, got ${groups.length}`
    );
  }

  // Normalize to uppercase
  const normalized = groups.map(g => g.toUpperCase()) as GroupCode[];

  // Check for duplicates
  const uniqueGroups = new Set(normalized);
  if (uniqueGroups.size !== 8) {
    throw new Error(
      `Duplicate group codes detected: ${groups.join(', ')}`
    );
  }

  // Check all groups are valid (A-L)
  const validGroups: GroupCode[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  for (const group of normalized) {
    if (!validGroups.includes(group)) {
      throw new Error(
        `Invalid group code: ${group}. Valid codes are A-L.`
      );
    }
  }

  return normalized;
}

/**
 * Sort group codes to create a canonical key for lookup
 */
function createCanonicalKey(groups: GroupCode[]): string {
  return [...groups].sort().join('');
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Assign third-place teams to round of 32 slots based on which groups qualified.
 * 
 * @param qualifiedGroups - Array of 8 group codes whose third-place teams qualified
 * @returns Map of slot pattern to assigned group code
 * 
 * @throws Error if input validation fails
 * @throws Error if the combination is not found in the official table
 */
export function assignThirdPlaceSlots(
  qualifiedGroups: string[]
): ThirdPlaceAssignmentOutput {
  // Validate and normalize input
  const validated = validateQualifiedGroups(qualifiedGroups);

  // Sort internally to make order irrelevant
  const canonicalKey = createCanonicalKey(validated);

  // Look up in official table
  const assignment = OFFICIAL_ASSIGNMENT_TABLE[canonicalKey];
  
  if (!assignment) {
    throw new Error(
      `Combination of qualified third-place groups not found in official table: ${canonicalKey}. ` +
      `This combination is not possible according to FIFA rules.`
    );
  }

  // Convert array to record with slot patterns
  const assignments: Record<SlotPattern, GroupCode> = {} as any;
  for (let i = 0; i < SLOT_PATTERNS.length; i++) {
    assignments[SLOT_PATTERNS[i]] = assignment[i];
  }

  return { assignments };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all slot patterns that need to be filled
 */
export function getAllSlotPatterns(): SlotPattern[] {
  return [...SLOT_PATTERNS];
}

/**
 * Check if a combination exists in the official table
 */
export function hasCombination(qualifiedGroups: string[]): boolean {
  try {
    const validated = validateQualifiedGroups(qualifiedGroups);
    const canonicalKey = createCanonicalKey(validated);
    return canonicalKey in OFFICIAL_ASSIGNMENT_TABLE;
  } catch {
    return false;
  }
}
