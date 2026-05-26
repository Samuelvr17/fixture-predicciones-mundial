/**
 * src/lib/scoring/scoring.ts
 *
 * Pure scoring engine for World Cup predictions.
 * Calculates user scores based on predictions vs actual results.
 */

// ============================================================================
// Types
// ============================================================================

export type MatchRound = 
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final';

export type TournamentRound = 
  | 'no_clasifica'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'final'
  | 'champion';

export interface MatchPrediction {
  match_id: string;
  predicted_team1_score: number;
  predicted_team2_score: number;
}

export interface PredictionAdvance {
  team_id: string;
  predicted_round: TournamentRound;
}

export interface PredictionSpecial {
  champion_team_id: string | null;
  third_place_team_id: string | null;
  top_scorer_name: string | null;
}

export interface Match {
  id: string;
  round: MatchRound;
  team1_id: string | null;
  team2_id: string | null;
}

export interface MatchResult {
  match_id: string;
  team1_score: number;
  team2_score: number;
  winner_team_id: string | null;
}

export interface ResolvedBracket {
  champion_team_id: string | null;
  third_place_team_id: string | null;
  official_top_scorer: string | null;
  team_advances: Record<string, TournamentRound>; // team_id -> actual round reached
}

export interface ScoreBreakdown {
  groupStageExactPoints: number;
  groupStageOutcomePoints: number;
  knockoutExactPoints: number;
  advancementPoints: number;
  championPoints: number;
  thirdPlacePoints: number;
  topScorerPoints: number;
  total: number;
  details?: {
    groupStageExact: Array<{ match_id: string; points: number }>;
    groupStageOutcome: Array<{ match_id: string; points: number }>;
    knockoutExact: Array<{ match_id: string; points: number }>;
    advancement: Array<{ team_id: string; round: TournamentRound; points: number }>;
  };
}

export interface CalculateScoreInput {
  group_id: string;
  user_id: string;
  match_predictions: MatchPrediction[];
  predictions_advances: PredictionAdvance[];
  predictions_specials: PredictionSpecial;
  matches: Match[];
  match_results: MatchResult[];
  resolvedBracket: ResolvedBracket;
}

// ============================================================================
// Constants
// ============================================================================

const POINTS = {
  GROUP_STAGE_EXACT: 5,
  GROUP_STAGE_OUTCOME: 2,
  KNOCKOUT_EXACT: 10,
  ROUND_OF_32: 20,
  ROUND_OF_16: 35,
  QUARTER_FINAL: 55,
  SEMI_FINAL: 80,
  FINAL: 110,
  CHAMPION: 150,
  THIRD_PLACE: 80,
  TOP_SCORER: 60,
} as const;

// Round order for advancement points calculation
const ROUND_ORDER: TournamentRound[] = [
  'no_clasifica',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
  'champion',
];

// Points for each round
const ROUND_POINTS: Record<TournamentRound, number> = {
  no_clasifica: 0,
  round_of_32: POINTS.ROUND_OF_32,
  round_of_16: POINTS.ROUND_OF_16,
  quarter_final: POINTS.QUARTER_FINAL,
  semi_final: POINTS.SEMI_FINAL,
  final: POINTS.FINAL,
  champion: POINTS.CHAMPION,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a string for comparison (trim, lowercase, remove accents, collapse spaces)
 */
export function normalizeString(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

/**
 * Get the round index for comparison
 */
function getRoundIndex(round: TournamentRound): number {
  return ROUND_ORDER.indexOf(round);
}

/**
 * Determine match outcome: 'team1', 'team2', or 'draw'
 */
function getOutcome(team1Score: number, team2Score: number): 'team1' | 'team2' | 'draw' {
  if (team1Score > team2Score) return 'team1';
  if (team2Score > team1Score) return 'team2';
  return 'draw';
}

/**
 * Check if a match is in group stage
 */
function isGroupStage(round: MatchRound): boolean {
  return round === 'group';
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate group stage match score
 */
function calculateGroupStageMatchScore(
  prediction: MatchPrediction,
  result: MatchResult
): { exact: number; outcome: number } {
  const { predicted_team1_score: p1, predicted_team2_score: p2 } = prediction;
  const { team1_score: r1, team2_score: r2 } = result;

  // Check exact score
  if (p1 === r1 && p2 === r2) {
    return { exact: POINTS.GROUP_STAGE_EXACT, outcome: 0 };
  }

  // Check outcome
  const predictedOutcome = getOutcome(p1, p2);
  const actualOutcome = getOutcome(r1, r2);

  if (predictedOutcome === actualOutcome) {
    return { exact: 0, outcome: POINTS.GROUP_STAGE_OUTCOME };
  }

  return { exact: 0, outcome: 0 };
}

/**
 * Calculate knockout match score (exact score only)
 */
function calculateKnockoutMatchScore(
  prediction: MatchPrediction,
  result: MatchResult
): number {
  const { predicted_team1_score: p1, predicted_team2_score: p2 } = prediction;
  const { team1_score: r1, team2_score: r2 } = result;

  // Exact score at 90 minutes
  if (p1 === r1 && p2 === r2) {
    return POINTS.KNOCKOUT_EXACT;
  }

  return 0;
}

/**
 * Calculate advancement points for a team
 * Points are cumulative: if a team reaches round_of_16, they get points for round_of_32 AND round_of_16
 */
function calculateAdvancementPoints(
  teamId: string,
  predictedRound: TournamentRound,
  actualRound: TournamentRound
): number {
  const predictedIndex = getRoundIndex(predictedRound);
  const actualIndex = getRoundIndex(actualRound);

  // If the team didn't advance beyond no_clasifica, no points
  if (actualIndex <= 0) {
    return 0;
  }

  // If the user predicted no_clasifica, no points
  if (predictedIndex <= 0) {
    return 0;
  }

  // Calculate cumulative points for all rounds the team actually reached
  // that were within or equal to the user's prediction
  let totalPoints = 0;
  for (let i = 1; i <= actualIndex; i++) {
    const round = ROUND_ORDER[i];
    if (i <= predictedIndex) {
      totalPoints += ROUND_POINTS[round];
    }
  }

  return totalPoints;
}

/**
 * Calculate champion points
 */
function calculateChampionPoints(
  predictedChampion: string | null,
  actualChampion: string | null
): number {
  if (!predictedChampion || !actualChampion) {
    return 0;
  }
  return predictedChampion === actualChampion ? POINTS.CHAMPION : 0;
}

/**
 * Calculate third place points
 */
function calculateThirdPlacePoints(
  predictedThird: string | null,
  actualThird: string | null
): number {
  if (!predictedThird || !actualThird) {
    return 0;
  }
  return predictedThird === actualThird ? POINTS.THIRD_PLACE : 0;
}

/**
 * Calculate top scorer points
 */
function calculateTopScorerPoints(
  predictedScorer: string | null,
  actualScorer: string | null
): number {
  if (!predictedScorer || !actualScorer) {
    return 0;
  }
  return normalizeString(predictedScorer) === normalizeString(actualScorer)
    ? POINTS.TOP_SCORER
    : 0;
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Calculate total score for a user in a group
 */
export function calculateScore(input: CalculateScoreInput): ScoreBreakdown {
  const {
    match_predictions,
    predictions_advances,
    predictions_specials,
    matches,
    match_results,
    resolvedBracket,
  } = input;

  // Create lookup maps
  const matchMap = new Map(matches.map(m => [m.id, m]));
  const resultMap = new Map(match_results.map(r => [r.match_id, r]));
  const predictionMap = new Map(match_predictions.map(p => [p.match_id, p]));
  const advanceMap = new Map(predictions_advances.map(a => [a.team_id, a]));

  // Initialize breakdown
  const breakdown: ScoreBreakdown = {
    groupStageExactPoints: 0,
    groupStageOutcomePoints: 0,
    knockoutExactPoints: 0,
    advancementPoints: 0,
    championPoints: 0,
    thirdPlacePoints: 0,
    topScorerPoints: 0,
    total: 0,
    details: {
      groupStageExact: [],
      groupStageOutcome: [],
      knockoutExact: [],
      advancement: [],
    },
  };

  // Calculate match scores
  for (const [matchId, result] of resultMap) {
    const match = matchMap.get(matchId);
    const prediction = predictionMap.get(matchId);

    if (!match || !prediction) {
      continue;
    }

    if (isGroupStage(match.round)) {
      const { exact, outcome } = calculateGroupStageMatchScore(prediction, result);
      breakdown.groupStageExactPoints += exact;
      breakdown.groupStageOutcomePoints += outcome;
      if (exact > 0) {
        breakdown.details!.groupStageExact.push({ match_id: matchId, points: exact });
      }
      if (outcome > 0) {
        breakdown.details!.groupStageOutcome.push({ match_id: matchId, points: outcome });
      }
    } else {
      const points = calculateKnockoutMatchScore(prediction, result);
      breakdown.knockoutExactPoints += points;
      if (points > 0) {
        breakdown.details!.knockoutExact.push({ match_id: matchId, points });
      }
    }
  }

  // Calculate advancement points
  for (const [teamId, actualRound] of Object.entries(resolvedBracket.team_advances)) {
    const advancePrediction = advanceMap.get(teamId);
    if (advancePrediction) {
      const points = calculateAdvancementPoints(
        teamId,
        advancePrediction.predicted_round,
        actualRound
      );
      breakdown.advancementPoints += points;
      if (points > 0) {
        breakdown.details!.advancement.push({
          team_id: teamId,
          round: actualRound,
          points,
        });
      }
    }
  }

  // Calculate special predictions
  breakdown.championPoints = calculateChampionPoints(
    predictions_specials.champion_team_id,
    resolvedBracket.champion_team_id
  );

  breakdown.thirdPlacePoints = calculateThirdPlacePoints(
    predictions_specials.third_place_team_id,
    resolvedBracket.third_place_team_id
  );

  breakdown.topScorerPoints = calculateTopScorerPoints(
    predictions_specials.top_scorer_name,
    resolvedBracket.official_top_scorer
  );

  // Calculate total
  breakdown.total =
    breakdown.groupStageExactPoints +
    breakdown.groupStageOutcomePoints +
    breakdown.knockoutExactPoints +
    breakdown.advancementPoints +
    breakdown.championPoints +
    breakdown.thirdPlacePoints +
    breakdown.topScorerPoints;

  return breakdown;
}
