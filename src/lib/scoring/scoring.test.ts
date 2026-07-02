/**
 * src/lib/scoring/scoring.test.ts
 *
 * Unit tests for the scoring engine
 */

import { describe, it, expect } from 'vitest';
import {
  calculateScore,
  evaluateKnockoutExactAward,
  inferKnockoutWinner,
  normalizeString,
  type CalculateScoreInput,
  type KnockoutMatchup,
  type MatchRound,
} from './scoring';

function createKnockoutMatchups(
  entries: Array<{
    match_id: string;
    team1_id: string;
    team2_id: string;
    winner_team_id?: string | null;
  }>,
): Map<string, KnockoutMatchup> {
  return new Map(
    entries.map((entry) => [
      entry.match_id,
      {
        team1_id: entry.team1_id,
        team2_id: entry.team2_id,
        winner_team_id: entry.winner_team_id,
      },
    ]),
  );
}

function createBaseInput(): CalculateScoreInput {
  return {
    group_id: 'group-1',
    user_id: 'user-1',
    match_predictions: [],
    predictions_advances: [],
    predictions_specials: {
      champion_team_id: null,
      third_place_team_id: null,
      top_scorer_name: null,
    },
    matches: [],
    match_results: [],
    resolvedBracket: {
      champion_team_id: null,
      third_place_team_id: null,
      official_top_scorer: null,
      official_best_goalkeeper: null,
      team_advances: {},
    },
  };
}

function buildKnockoutScoreInput({
  matchId,
  round,
  team1Id,
  team2Id,
  result,
  prediction,
  officialMatchup,
  predictedMatchup,
}: {
  matchId: string;
  round: MatchRound;
  team1Id: string;
  team2Id: string;
  result: {
    team1_score: number;
    team2_score: number;
    winner_team_id?: string | null;
  };
  prediction: {
    predicted_team1_score: number;
    predicted_team2_score: number;
    predicted_winner_team_id?: string | null;
  };
  officialMatchup: {
    team1_id: string;
    team2_id: string;
    winner_team_id?: string | null;
  };
  predictedMatchup: {
    team1_id: string;
    team2_id: string;
    winner_team_id?: string | null;
  };
}): CalculateScoreInput {
  const input = createBaseInput();
  input.matches = [{ id: matchId, round, team1_id: team1Id, team2_id: team2Id }];
  input.match_results = [
    {
      match_id: matchId,
      team1_score: result.team1_score,
      team2_score: result.team2_score,
      winner_team_id: result.winner_team_id ?? null,
    },
  ];
  input.match_predictions = [{ match_id: matchId, ...prediction }];
  input.official_knockout_matchups = createKnockoutMatchups([
    { match_id: matchId, ...officialMatchup },
  ]);
  input.predicted_knockout_matchups = createKnockoutMatchups([
    { match_id: matchId, ...predictedMatchup },
  ]);
  return input;
}

describe('normalizeString', () => {
  it('should trim, lowercase, remove accents, and collapse spaces', () => {
    expect(normalizeString('  Lionel MESSI  ')).toBe('lionel messi');
    expect(normalizeString('Ángel Di María')).toBe('angel di maria');
    expect(normalizeString('Kylian  Mbappé')).toBe('kylian mbappe');
  });
});

describe('calculateScore', () => {
  // Test 1: marcador exacto fase grupos suma 5
  it('should award 5 points for exact group stage score', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      { match_id: 'match-1', predicted_team1_score: 2, predicted_team2_score: 1 },
    ];

    const result = calculateScore(input);

    expect(result.groupStageExactPoints).toBe(5);
    expect(result.groupStageOutcomePoints).toBe(0);
    expect(result.total).toBe(5);
  });

  // Test 2: ganador correcto sin exacto suma 2
  it('should award 2 points for correct group stage outcome without exact score', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      { match_id: 'match-1', predicted_team1_score: 1, predicted_team2_score: 0 },
    ];

    const result = calculateScore(input);

    expect(result.groupStageExactPoints).toBe(0);
    expect(result.groupStageOutcomePoints).toBe(2);
    expect(result.total).toBe(2);
  });

  // Test 3: marcador incorrecto suma 0
  it('should award 0 points for incorrect group stage prediction', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      { match_id: 'match-1', predicted_team1_score: 0, predicted_team2_score: 2 },
    ];

    const result = calculateScore(input);

    expect(result.groupStageExactPoints).toBe(0);
    expect(result.groupStageOutcomePoints).toBe(0);
    expect(result.total).toBe(0);
  });

  // Test 4: marcador exacto eliminatoria suma 10
  it('should award 10 points for exact knockout score', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'round_of_16', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 1, team2_score: 1, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      {
        match_id: 'match-1',
        predicted_team1_score: 1,
        predicted_team2_score: 1,
        predicted_winner_team_id: 'team-1',
      },
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'team-1', team2_id: 'team-2', winner_team_id: 'team-1' },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'team-1', team2_id: 'team-2', winner_team_id: 'team-1' },
    ]);

    const result = calculateScore(input);

    expect(result.knockoutExactPoints).toBe(10);
    expect(result.total).toBe(10);
  });

  // Test 5: avances acumulables por ronda
  it('should award cumulative advancement points for rounds reached', () => {
    const input = createBaseInput();
    input.predictions_advances = [
      { team_id: 'team-1', predicted_round: 'semi_final' },
    ];
    input.resolvedBracket.team_advances = {
      'team-1': 'semi_final',
    };

    const result = calculateScore(input);

    // round_of_32 (20) + round_of_16 (35) + quarter_final (55) + semi_final (80) = 190
    expect(result.advancementPoints).toBe(190);
    expect(result.total).toBe(190);
  });

  // Test 6: no suma rondas no alcanzadas
  it('should not award points for rounds not reached', () => {
    const input = createBaseInput();
    input.predictions_advances = [
      { team_id: 'team-1', predicted_round: 'champion' },
    ];
    input.resolvedBracket.team_advances = {
      'team-1': 'quarter_final',
    };

    const result = calculateScore(input);

    // round_of_32 (20) + round_of_16 (35) + quarter_final (55) = 110
    // Should NOT include semi_final (80), final (110), champion (150)
    expect(result.advancementPoints).toBe(110);
    expect(result.total).toBe(110);
  });

  // Test 7: campeón correcto suma 150
  it('should award 150 points for correct champion prediction', () => {
    const input = createBaseInput();
    input.predictions_specials.champion_team_id = 'team-1';
    input.resolvedBracket.champion_team_id = 'team-1';

    const result = calculateScore(input);

    expect(result.championPoints).toBe(150);
    expect(result.total).toBe(150);
  });

  // Test 8: tercer puesto correcto suma 80
  it('should award 80 points for correct third place prediction', () => {
    const input = createBaseInput();
    input.predictions_specials.third_place_team_id = 'team-2';
    input.resolvedBracket.third_place_team_id = 'team-2';

    const result = calculateScore(input);

    expect(result.thirdPlacePoints).toBe(80);
    expect(result.total).toBe(80);
  });

  // Test 9: goleador correcto normalizado suma 60
  it('should award 60 points for correct top scorer prediction with normalization', () => {
    const input = createBaseInput();
    input.predictions_specials.top_scorer_name = '  Lionel MESSI  ';
    input.resolvedBracket.official_top_scorer = 'Lionel Messi';

    const result = calculateScore(input);

    expect(result.topScorerPoints).toBe(60);
    expect(result.total).toBe(60);
  });

  // Test 10: no duplica puntos si se recalcula
  it('should not duplicate points when recalculated', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      { match_id: 'match-1', predicted_team1_score: 2, predicted_team2_score: 1 },
    ];

    const result1 = calculateScore(input);
    const result2 = calculateScore(input);

    expect(result1.total).toBe(result2.total);
    expect(result1.total).toBe(5);
  });

  // Test 11: bracket incompleto no rompe scoring
  it('should handle incomplete bracket without breaking', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      { match_id: 'match-1', predicted_team1_score: 2, predicted_team2_score: 1 },
    ];
    input.predictions_advances = [
      { team_id: 'team-1', predicted_round: 'champion' },
    ];
    // Empty team_advances (incomplete bracket)
    input.resolvedBracket.team_advances = {};

    const result = calculateScore(input);

    // Should still calculate match scores
    expect(result.groupStageExactPoints).toBe(5);
    expect(result.advancementPoints).toBe(0);
    expect(result.total).toBe(5);
  });

  // Test 12: usuario sin predicciones da total 0
  it('should return 0 total for user with no predictions', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'team-1' },
    ];
    // No match_predictions, no predictions_advances, no predictions_specials

    const result = calculateScore(input);

    expect(result.total).toBe(0);
    expect(result.groupStageExactPoints).toBe(0);
    expect(result.groupStageOutcomePoints).toBe(0);
    expect(result.knockoutExactPoints).toBe(0);
    expect(result.advancementPoints).toBe(0);
    expect(result.championPoints).toBe(0);
    expect(result.thirdPlacePoints).toBe(0);
    expect(result.topScorerPoints).toBe(0);
  });

  // Additional test: empate en fase de grupos
  it('should award 2 points for correct draw prediction in group stage', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 1, team2_score: 1, winner_team_id: null },
    ];
    input.match_predictions = [
      { match_id: 'match-1', predicted_team1_score: 0, predicted_team2_score: 0 },
    ];

    const result = calculateScore(input);

    expect(result.groupStageExactPoints).toBe(0);
    expect(result.groupStageOutcomePoints).toBe(2);
    expect(result.total).toBe(2);
  });

  // Additional test: empate exacto en fase de grupos
  it('should award 5 points for exact draw prediction in group stage', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 1, team2_score: 1, winner_team_id: null },
    ];
    input.match_predictions = [
      { match_id: 'match-1', predicted_team1_score: 1, predicted_team2_score: 1 },
    ];

    const result = calculateScore(input);

    expect(result.groupStageExactPoints).toBe(5);
    expect(result.groupStageOutcomePoints).toBe(0);
    expect(result.total).toBe(5);
  });

  // Additional test: multiple matches
  it('should correctly sum points from multiple matches', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
      { id: 'match-2', round: 'group', team1_id: 'team-3', team2_id: 'team-4' },
      { id: 'match-3', round: 'round_of_16', team1_id: 'team-1', team2_id: 'team-3' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'team-1' },
      { match_id: 'match-2', team1_score: 1, team2_score: 1, winner_team_id: null },
      { match_id: 'match-3', team1_score: 2, team2_score: 0, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      { match_id: 'match-1', predicted_team1_score: 2, predicted_team2_score: 1 }, // exact: 5
      { match_id: 'match-2', predicted_team1_score: 0, predicted_team2_score: 0 }, // draw: 2
      {
        match_id: 'match-3',
        predicted_team1_score: 2,
        predicted_team2_score: 0,
        predicted_winner_team_id: 'team-1',
      }, // exact: 10
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-3', team1_id: 'team-1', team2_id: 'team-3', winner_team_id: 'team-1' },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-3', team1_id: 'team-1', team2_id: 'team-3', winner_team_id: 'team-1' },
    ]);

    const result = calculateScore(input);

    expect(result.groupStageExactPoints).toBe(5);
    expect(result.groupStageOutcomePoints).toBe(2);
    expect(result.knockoutExactPoints).toBe(10);
    expect(result.total).toBe(17);
  });

  // Additional test: advancement with no_clasifica prediction
  it('should award 0 points when user predicted no_clasifica', () => {
    const input = createBaseInput();
    input.predictions_advances = [
      { team_id: 'team-1', predicted_round: 'no_clasifica' },
    ];
    input.resolvedBracket.team_advances = {
      'team-1': 'champion',
    };

    const result = calculateScore(input);

    expect(result.advancementPoints).toBe(0);
  });

  // Additional test: team that doesn't advance
  it('should award 0 points for team that does not advance', () => {
    const input = createBaseInput();
    input.predictions_advances = [
      { team_id: 'team-1', predicted_round: 'champion' },
    ];
    input.resolvedBracket.team_advances = {
      'team-1': 'no_clasifica',
    };

    const result = calculateScore(input);

    expect(result.advancementPoints).toBe(0);
  });

  // Additional test: incorrect champion prediction
  it('should award 0 points for incorrect champion prediction', () => {
    const input = createBaseInput();
    input.predictions_specials.champion_team_id = 'team-1';
    input.resolvedBracket.champion_team_id = 'team-2';

    const result = calculateScore(input);

    expect(result.championPoints).toBe(0);
  });

  // Additional test: incorrect top scorer prediction
  it('should award 0 points for incorrect top scorer prediction', () => {
    const input = createBaseInput();
    input.predictions_specials.top_scorer_name = 'Lionel Messi';
    input.resolvedBracket.official_top_scorer = 'Kylian Mbappé';

    const result = calculateScore(input);

    expect(result.topScorerPoints).toBe(0);
  });


  it('should award 60 top scorer points for matching candidate IDs', () => {
    const input = createBaseInput();
    input.predictions_specials.top_scorer_candidate_id = 'candidate-1';
    input.resolvedBracket.official_top_scorer_candidate_id = 'candidate-1';

    const result = calculateScore(input);

    expect(result.topScorerPoints).toBe(60);
  });

  it('should award 0 top scorer points for different candidate IDs', () => {
    const input = createBaseInput();
    input.predictions_specials.top_scorer_candidate_id = 'candidate-1';
    input.resolvedBracket.official_top_scorer_candidate_id = 'candidate-2';

    const result = calculateScore(input);

    expect(result.topScorerPoints).toBe(0);
  });

  it('should use normalized text fallback for top scorer when IDs are missing', () => {
    const input = createBaseInput();
    input.predictions_specials.top_scorer_name = 'Kylian Mbappe';
    input.resolvedBracket.official_top_scorer = 'Kylian Mbappé';

    const result = calculateScore(input);

    expect(result.topScorerPoints).toBe(60);
  });

  it('should award 0 top scorer points for different text fallback names', () => {
    const input = createBaseInput();
    input.predictions_specials.top_scorer_name = 'Harry Kane';
    input.resolvedBracket.official_top_scorer = 'Kylian Mbappé';

    const result = calculateScore(input);

    expect(result.topScorerPoints).toBe(0);
  });

  it('should award 60 best goalkeeper points for matching candidate IDs', () => {
    const input = createBaseInput();
    input.predictions_specials.best_goalkeeper_candidate_id = 'keeper-1';
    input.resolvedBracket.official_best_goalkeeper_candidate_id = 'keeper-1';

    const result = calculateScore(input);

    expect(result.bestGoalkeeperPoints).toBe(60);
  });

  it('should award 0 best goalkeeper points for different candidate IDs', () => {
    const input = createBaseInput();
    input.predictions_specials.best_goalkeeper_candidate_id = 'keeper-1';
    input.resolvedBracket.official_best_goalkeeper_candidate_id = 'keeper-2';

    const result = calculateScore(input);

    expect(result.bestGoalkeeperPoints).toBe(0);
  });

  it('should use normalized text fallback for best goalkeeper when IDs are missing', () => {
    const input = createBaseInput();
    input.predictions_specials.best_goalkeeper_name = 'Dibu Martinez';
    input.resolvedBracket.official_best_goalkeeper = 'Dibu Martínez';

    const result = calculateScore(input);

    expect(result.bestGoalkeeperPoints).toBe(60);
  });

  it('should award 0 best goalkeeper points for different text fallback names', () => {
    const input = createBaseInput();
    input.predictions_specials.best_goalkeeper_name = 'Alisson';
    input.resolvedBracket.official_best_goalkeeper = 'Dibu Martínez';

    const result = calculateScore(input);

    expect(result.bestGoalkeeperPoints).toBe(0);
  });

  it('should include top scorer and best goalkeeper points in total', () => {
    const input = createBaseInput();
    input.predictions_specials.top_scorer_candidate_id = 'candidate-1';
    input.predictions_specials.best_goalkeeper_candidate_id = 'keeper-1';
    input.resolvedBracket.official_top_scorer_candidate_id = 'candidate-1';
    input.resolvedBracket.official_best_goalkeeper_candidate_id = 'keeper-1';

    const result = calculateScore(input);

    expect(result.topScorerPoints).toBe(60);
    expect(result.bestGoalkeeperPoints).toBe(60);
    expect(result.total).toBe(120);
  });

  // Additional test: null special predictions
  it('should handle null special predictions', () => {
    const input = createBaseInput();
    input.predictions_specials = {
      champion_team_id: null,
      third_place_team_id: null,
      top_scorer_name: null,
    };
    input.resolvedBracket = {
      champion_team_id: 'team-1',
      third_place_team_id: 'team-2',
      official_top_scorer: 'Lionel Messi',
      official_best_goalkeeper: null,
      team_advances: {},
    };

    const result = calculateScore(input);

    expect(result.championPoints).toBe(0);
    expect(result.thirdPlacePoints).toBe(0);
    expect(result.topScorerPoints).toBe(0);
  });

  // Additional test: comprehensive scoring
  it('should correctly calculate comprehensive score with all categories', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
      { id: 'match-2', round: 'round_of_16', team1_id: 'team-1', team2_id: 'team-3' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'team-1' },
      { match_id: 'match-2', team1_score: 1, team2_score: 1, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      {
        match_id: 'match-1',
        predicted_team1_score: 2,
        predicted_team2_score: 1,
      }, // exact: 5
      {
        match_id: 'match-2',
        predicted_team1_score: 1,
        predicted_team2_score: 1,
        predicted_winner_team_id: 'team-1',
      }, // exact: 10
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-2', team1_id: 'team-1', team2_id: 'team-3', winner_team_id: 'team-1' },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-2', team1_id: 'team-1', team2_id: 'team-3', winner_team_id: 'team-1' },
    ]);
    input.predictions_advances = [
      { team_id: 'team-1', predicted_round: 'champion' },
    ];
    input.resolvedBracket = {
      champion_team_id: 'team-1',
      third_place_team_id: 'team-2',
      official_top_scorer: 'Lionel Messi',
      official_best_goalkeeper: 'Dibu Martínez',
      team_advances: {
        'team-1': 'champion',
      },
    };
    input.predictions_specials = {
      champion_team_id: 'team-1',
      third_place_team_id: 'team-2',
      top_scorer_name: 'Lionel Messi',
      best_goalkeeper_name: 'Dibu Martinez',
    };

    const result = calculateScore(input);

    // Group exact: 5
    // Knockout exact: 10
    // Advancement: 20+35+55+80+110 = 300 (champion points handled separately)
    // Champion: 150
    // Third place: 80
    // Top scorer: 60
    // Best goalkeeper: 60
    // Total: 5+10+300+150+80+60+60 = 665
    expect(result.groupStageExactPoints).toBe(5);
    expect(result.knockoutExactPoints).toBe(10);
    expect(result.advancementPoints).toBe(300);
    expect(result.championPoints).toBe(150);
    expect(result.thirdPlacePoints).toBe(80);
    expect(result.topScorerPoints).toBe(60);
    expect(result.bestGoalkeeperPoints).toBe(60);
    expect(result.total).toBe(665);
  });

  it('should award 0 knockout exact points when score matches but predicted matchup differs', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'round_of_32', team1_id: 'south-africa', team2_id: 'canada' },
    ];
    input.match_results = [
      {
        match_id: 'match-1',
        team1_score: 0,
        team2_score: 1,
        winner_team_id: 'canada',
      },
    ];
    input.match_predictions = [
      {
        match_id: 'match-1',
        predicted_team1_score: 0,
        predicted_team2_score: 1,
        predicted_winner_team_id: 'canada',
      },
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      {
        match_id: 'match-1',
        team1_id: 'south-africa',
        team2_id: 'canada',
        winner_team_id: 'canada',
      },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      {
        match_id: 'match-1',
        team1_id: 'mexico',
        team2_id: 'canada',
        winner_team_id: 'canada',
      },
    ]);

    const result = calculateScore(input);

    expect(result.knockoutExactPoints).toBe(0);
    expect(result.details?.knockoutExact).toEqual([]);
  });

  it('should award 10 knockout exact points when score and resolved matchup both match', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'round_of_32', team1_id: 'south-africa', team2_id: 'canada' },
    ];
    input.match_results = [
      {
        match_id: 'match-1',
        team1_score: 0,
        team2_score: 1,
        winner_team_id: 'canada',
      },
    ];
    input.match_predictions = [
      {
        match_id: 'match-1',
        predicted_team1_score: 0,
        predicted_team2_score: 1,
        predicted_winner_team_id: 'canada',
      },
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      {
        match_id: 'match-1',
        team1_id: 'south-africa',
        team2_id: 'canada',
        winner_team_id: 'canada',
      },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      {
        match_id: 'match-1',
        team1_id: 'south-africa',
        team2_id: 'canada',
        winner_team_id: 'canada',
      },
    ]);

    const result = calculateScore(input);

    expect(result.knockoutExactPoints).toBe(10);
    expect(result.details?.knockoutExact).toEqual([{ match_id: 'match-1', points: 10 }]);
  });

  it('should award 0 knockout exact points when score and matchup match but winner differs on a draw', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'round_of_16', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 1, team2_score: 1, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      {
        match_id: 'match-1',
        predicted_team1_score: 1,
        predicted_team2_score: 1,
        predicted_winner_team_id: 'team-2',
      },
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'team-1', team2_id: 'team-2', winner_team_id: 'team-1' },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'team-1', team2_id: 'team-2', winner_team_id: 'team-2' },
    ]);

    const result = calculateScore(input);

    expect(result.knockoutExactPoints).toBe(0);
    expect(result.details?.knockoutExact).toEqual([]);
  });

  it('should award 10 knockout exact points when score and matchup match with inferred predicted winner', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'round_of_16', team1_id: 'brazil', team2_id: 'japan' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'brazil' },
    ];
    input.match_predictions = [
      {
        match_id: 'match-1',
        predicted_team1_score: 2,
        predicted_team2_score: 1,
        predicted_winner_team_id: null,
      },
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'brazil', team2_id: 'japan', winner_team_id: 'brazil' },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'brazil', team2_id: 'japan' },
    ]);

    const result = calculateScore(input);

    expect(result.knockoutExactPoints).toBe(10);
    expect(result.details?.knockoutExact).toEqual([{ match_id: 'match-1', points: 10 }]);
  });

  it('should award 0 knockout exact points when score and matchup match but explicit predicted winner is wrong', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'round_of_16', team1_id: 'brazil', team2_id: 'japan' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'brazil' },
    ];
    input.match_predictions = [
      {
        match_id: 'match-1',
        predicted_team1_score: 2,
        predicted_team2_score: 1,
        predicted_winner_team_id: 'japan',
      },
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'brazil', team2_id: 'japan', winner_team_id: 'brazil' },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'brazil', team2_id: 'japan', winner_team_id: 'japan' },
    ]);

    const result = calculateScore(input);

    expect(result.knockoutExactPoints).toBe(0);
    expect(result.details?.knockoutExact).toEqual([]);
  });

  it('should detect false negatives when predicted winner is inferable but not stored', () => {
    const evaluation = evaluateKnockoutExactAward(
      {
        match_id: 'match-1',
        predicted_team1_score: 2,
        predicted_team2_score: 1,
        predicted_winner_team_id: null,
      },
      {
        match_id: 'match-1',
        team1_score: 2,
        team2_score: 1,
        winner_team_id: 'brazil',
      },
      { team1_id: 'brazil', team2_id: 'japan', winner_team_id: 'brazil' },
      { team1_id: 'brazil', team2_id: 'japan' },
    );

    expect(evaluation.should_award).toBe(true);
    expect(evaluation.points).toBe(10);
    expect(evaluation.predicted_winner_raw).toBeNull();
    expect(evaluation.predicted_winner_inferred).toBe('brazil');
    expect(evaluation.winner_matches).toBe(true);

    const currentlyAwarded = 0;
    const issueType =
      currentlyAwarded > 0 && !evaluation.should_award
        ? 'false_positive'
        : evaluation.should_award && currentlyAwarded === 0
          ? 'false_negative'
          : 'ok';

    expect(issueType).toBe('false_negative');
  });

  it('should not change group stage scoring when knockout matchup validation is enabled', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'match-1', round: 'group', team1_id: 'team-1', team2_id: 'team-2' },
    ];
    input.match_results = [
      { match_id: 'match-1', team1_score: 2, team2_score: 1, winner_team_id: 'team-1' },
    ];
    input.match_predictions = [
      { match_id: 'match-1', predicted_team1_score: 2, predicted_team2_score: 1 },
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'team-1', team2_id: 'team-2' },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      { match_id: 'match-1', team1_id: 'team-3', team2_id: 'team-4' },
    ]);

    const result = calculateScore(input);

    expect(result.groupStageExactPoints).toBe(5);
    expect(result.knockoutExactPoints).toBe(0);
    expect(result.total).toBe(5);
  });
});

describe('knockout future rounds regression', () => {
  it('1. round_of_32: exact score, same matchup, inferred winner => 10', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'r32-74',
        round: 'round_of_32',
        team1Id: 'south-africa',
        team2Id: 'canada',
        result: { team1_score: 0, team2_score: 1, winner_team_id: 'canada' },
        prediction: {
          predicted_team1_score: 0,
          predicted_team2_score: 1,
          predicted_winner_team_id: null,
        },
        officialMatchup: {
          team1_id: 'south-africa',
          team2_id: 'canada',
          winner_team_id: 'canada',
        },
        predictedMatchup: { team1_id: 'south-africa', team2_id: 'canada' },
      }),
    );

    expect(result.knockoutExactPoints).toBe(10);
    expect(result.details?.knockoutExact).toEqual([{ match_id: 'r32-74', points: 10 }]);
  });

  it('2. round_of_16: teams from W73/W74 slots, same matchup, exact score => 10', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'match-89',
        round: 'round_of_16',
        team1Id: 'w73-winner',
        team2Id: 'w74-winner',
        result: { team1_score: 2, team2_score: 1, winner_team_id: 'w73-winner' },
        prediction: {
          predicted_team1_score: 2,
          predicted_team2_score: 1,
          predicted_winner_team_id: 'w73-winner',
        },
        officialMatchup: {
          team1_id: 'w73-winner',
          team2_id: 'w74-winner',
          winner_team_id: 'w73-winner',
        },
        predictedMatchup: {
          team1_id: 'w73-winner',
          team2_id: 'w74-winner',
          winner_team_id: 'w73-winner',
        },
      }),
    );

    expect(result.knockoutExactPoints).toBe(10);
    expect(result.total).toBe(10);
  });

  it('3. quarter_final: derived winners, exact score and matchup => 10', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'match-97',
        round: 'quarter_final',
        team1Id: 'w89-winner',
        team2Id: 'w90-winner',
        result: { team1_score: 1, team2_score: 0, winner_team_id: 'w89-winner' },
        prediction: {
          predicted_team1_score: 1,
          predicted_team2_score: 0,
          predicted_winner_team_id: null,
        },
        officialMatchup: {
          team1_id: 'w89-winner',
          team2_id: 'w90-winner',
          winner_team_id: 'w89-winner',
        },
        predictedMatchup: { team1_id: 'w89-winner', team2_id: 'w90-winner' },
      }),
    );

    expect(result.knockoutExactPoints).toBe(10);
  });

  it('4. semi_final: derived winners, exact score and matchup => 10', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'match-101',
        round: 'semi_final',
        team1Id: 'w97-winner',
        team2Id: 'w98-winner',
        result: { team1_score: 3, team2_score: 2, winner_team_id: 'w97-winner' },
        prediction: {
          predicted_team1_score: 3,
          predicted_team2_score: 2,
          predicted_winner_team_id: null,
        },
        officialMatchup: {
          team1_id: 'w97-winner',
          team2_id: 'w98-winner',
          winner_team_id: 'w97-winner',
        },
        predictedMatchup: { team1_id: 'w97-winner', team2_id: 'w98-winner' },
      }),
    );

    expect(result.knockoutExactPoints).toBe(10);
  });

  it('5. final: derived winners, exact score and matchup => 10', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'match-final',
        round: 'final',
        team1Id: 'w101-winner',
        team2Id: 'w102-winner',
        result: { team1_score: 2, team2_score: 2, winner_team_id: 'w101-winner' },
        prediction: {
          predicted_team1_score: 2,
          predicted_team2_score: 2,
          predicted_winner_team_id: 'w101-winner',
        },
        officialMatchup: {
          team1_id: 'w101-winner',
          team2_id: 'w102-winner',
          winner_team_id: 'w101-winner',
        },
        predictedMatchup: {
          team1_id: 'w101-winner',
          team2_id: 'w102-winner',
          winner_team_id: 'w101-winner',
        },
      }),
    );

    expect(result.knockoutExactPoints).toBe(10);
  });

  it('6. third_place: losers from semifinals (L101/L102), exact prediction => 10', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'match-third',
        round: 'third_place',
        team1Id: 'l101-loser',
        team2Id: 'l102-loser',
        result: { team1_score: 1, team2_score: 0, winner_team_id: 'l101-loser' },
        prediction: {
          predicted_team1_score: 1,
          predicted_team2_score: 0,
          predicted_winner_team_id: null,
        },
        officialMatchup: {
          team1_id: 'l101-loser',
          team2_id: 'l102-loser',
          winner_team_id: 'l101-loser',
        },
        predictedMatchup: { team1_id: 'l101-loser', team2_id: 'l102-loser' },
      }),
    );

    expect(result.knockoutExactPoints).toBe(10);
  });

  it('7. knockout draw with correct explicit winner_team_id => 10', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'r16-draw',
        round: 'round_of_16',
        team1Id: 'brazil',
        team2Id: 'japan',
        result: { team1_score: 1, team2_score: 1, winner_team_id: 'brazil' },
        prediction: {
          predicted_team1_score: 1,
          predicted_team2_score: 1,
          predicted_winner_team_id: 'brazil',
        },
        officialMatchup: {
          team1_id: 'brazil',
          team2_id: 'japan',
          winner_team_id: 'brazil',
        },
        predictedMatchup: {
          team1_id: 'brazil',
          team2_id: 'japan',
          winner_team_id: 'brazil',
        },
      }),
    );

    expect(result.knockoutExactPoints).toBe(10);
  });

  it('8. knockout draw with incorrect explicit winner_team_id => 0', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'r16-draw-wrong',
        round: 'round_of_16',
        team1Id: 'brazil',
        team2Id: 'japan',
        result: { team1_score: 1, team2_score: 1, winner_team_id: 'brazil' },
        prediction: {
          predicted_team1_score: 1,
          predicted_team2_score: 1,
          predicted_winner_team_id: 'japan',
        },
        officialMatchup: {
          team1_id: 'brazil',
          team2_id: 'japan',
          winner_team_id: 'brazil',
        },
        predictedMatchup: {
          team1_id: 'brazil',
          team2_id: 'japan',
          winner_team_id: 'japan',
        },
      }),
    );

    expect(result.knockoutExactPoints).toBe(0);
    expect(result.details?.knockoutExact).toEqual([]);
  });

  it('9. exact score but swapped team order => 0', () => {
    const evaluation = evaluateKnockoutExactAward(
      {
        match_id: 'r16-swapped',
        predicted_team1_score: 1,
        predicted_team2_score: 1,
        predicted_winner_team_id: 'brazil',
      },
      {
        match_id: 'r16-swapped',
        team1_score: 1,
        team2_score: 1,
        winner_team_id: 'brazil',
      },
      { team1_id: 'brazil', team2_id: 'japan', winner_team_id: 'brazil' },
      { team1_id: 'japan', team2_id: 'brazil', winner_team_id: 'brazil' },
    );

    expect(evaluation.score_matches).toBe(true);
    expect(evaluation.matchup_matches_same_order).toBe(false);
    expect(evaluation.matchup_matches_swapped).toBe(true);
    expect(evaluation.should_award).toBe(false);
    expect(evaluation.points).toBe(0);

    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'r16-swapped',
        round: 'round_of_16',
        team1Id: 'brazil',
        team2Id: 'japan',
        result: { team1_score: 1, team2_score: 1, winner_team_id: 'brazil' },
        prediction: {
          predicted_team1_score: 1,
          predicted_team2_score: 1,
          predicted_winner_team_id: 'brazil',
        },
        officialMatchup: {
          team1_id: 'brazil',
          team2_id: 'japan',
          winner_team_id: 'brazil',
        },
        predictedMatchup: {
          team1_id: 'japan',
          team2_id: 'brazil',
          winner_team_id: 'brazil',
        },
      }),
    );

    expect(result.knockoutExactPoints).toBe(0);
  });

  it('10. exact score but different opponent => 0', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'r32-opponent',
        round: 'round_of_32',
        team1Id: 'south-africa',
        team2Id: 'canada',
        result: { team1_score: 0, team2_score: 1, winner_team_id: 'canada' },
        prediction: {
          predicted_team1_score: 0,
          predicted_team2_score: 1,
          predicted_winner_team_id: 'canada',
        },
        officialMatchup: {
          team1_id: 'south-africa',
          team2_id: 'canada',
          winner_team_id: 'canada',
        },
        predictedMatchup: {
          team1_id: 'mexico',
          team2_id: 'canada',
          winner_team_id: 'canada',
        },
      }),
    );

    expect(result.knockoutExactPoints).toBe(0);
    expect(result.details?.knockoutExact).toEqual([]);
  });

  it('11. correct winner but non-exact score => 0 (knockout is exact-score only)', () => {
    const result = calculateScore(
      buildKnockoutScoreInput({
        matchId: 'r16-outcome-only',
        round: 'round_of_16',
        team1Id: 'brazil',
        team2Id: 'japan',
        result: { team1_score: 2, team2_score: 1, winner_team_id: 'brazil' },
        prediction: {
          predicted_team1_score: 3,
          predicted_team2_score: 0,
          predicted_winner_team_id: null,
        },
        officialMatchup: {
          team1_id: 'brazil',
          team2_id: 'japan',
          winner_team_id: 'brazil',
        },
        predictedMatchup: { team1_id: 'brazil', team2_id: 'japan' },
      }),
    );

    expect(result.knockoutExactPoints).toBe(0);
    expect(result.groupStageOutcomePoints).toBe(0);
  });

  it('12. predicted_winner_team_id null with non-draw score infers winner', () => {
    expect(
      inferKnockoutWinner(null, 2, 1, 'brazil', 'japan'),
    ).toBe('brazil');

    const evaluation = evaluateKnockoutExactAward(
      {
        match_id: 'r16-infer',
        predicted_team1_score: 2,
        predicted_team2_score: 1,
        predicted_winner_team_id: null,
      },
      {
        match_id: 'r16-infer',
        team1_score: 2,
        team2_score: 1,
        winner_team_id: 'brazil',
      },
      { team1_id: 'brazil', team2_id: 'japan', winner_team_id: 'brazil' },
      { team1_id: 'brazil', team2_id: 'japan' },
    );

    expect(evaluation.predicted_winner_inferred).toBe('brazil');
    expect(evaluation.should_award).toBe(true);
    expect(evaluation.points).toBe(10);
  });

  it('13. predicted_winner_team_id null with draw does not infer; requires explicit winner', () => {
    expect(
      inferKnockoutWinner(null, 1, 1, 'brazil', 'japan'),
    ).toBeNull();

    const evaluation = evaluateKnockoutExactAward(
      {
        match_id: 'r16-draw-null',
        predicted_team1_score: 1,
        predicted_team2_score: 1,
        predicted_winner_team_id: null,
      },
      {
        match_id: 'r16-draw-null',
        team1_score: 1,
        team2_score: 1,
        winner_team_id: 'brazil',
      },
      { team1_id: 'brazil', team2_id: 'japan', winner_team_id: 'brazil' },
      { team1_id: 'brazil', team2_id: 'japan' },
    );

    expect(evaluation.predicted_winner_inferred).toBeNull();
    expect(evaluation.winner_matches).toBe(false);
    expect(evaluation.should_award).toBe(false);
    expect(evaluation.points).toBe(0);
  });

  it('14. details.knockoutExact includes only awarded knockout matches', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'valid-r32', round: 'round_of_32', team1_id: 'a', team2_id: 'b' },
      { id: 'invalid-r16', round: 'round_of_16', team1_id: 'c', team2_id: 'd' },
      { id: 'valid-qf', round: 'quarter_final', team1_id: 'e', team2_id: 'f' },
    ];
    input.match_results = [
      { match_id: 'valid-r32', team1_score: 1, team2_score: 0, winner_team_id: 'a' },
      { match_id: 'invalid-r16', team1_score: 2, team2_score: 1, winner_team_id: 'c' },
      { match_id: 'valid-qf', team1_score: 0, team2_score: 0, winner_team_id: 'e' },
    ];
    input.match_predictions = [
      {
        match_id: 'valid-r32',
        predicted_team1_score: 1,
        predicted_team2_score: 0,
        predicted_winner_team_id: null,
      },
      {
        match_id: 'invalid-r16',
        predicted_team1_score: 3,
        predicted_team2_score: 0,
        predicted_winner_team_id: null,
      },
      {
        match_id: 'valid-qf',
        predicted_team1_score: 0,
        predicted_team2_score: 0,
        predicted_winner_team_id: 'e',
      },
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      { match_id: 'valid-r32', team1_id: 'a', team2_id: 'b', winner_team_id: 'a' },
      { match_id: 'invalid-r16', team1_id: 'c', team2_id: 'd', winner_team_id: 'c' },
      { match_id: 'valid-qf', team1_id: 'e', team2_id: 'f', winner_team_id: 'e' },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      { match_id: 'valid-r32', team1_id: 'a', team2_id: 'b' },
      { match_id: 'invalid-r16', team1_id: 'c', team2_id: 'd' },
      { match_id: 'valid-qf', team1_id: 'e', team2_id: 'f', winner_team_id: 'e' },
    ]);

    const result = calculateScore(input);

    expect(result.knockoutExactPoints).toBe(20);
    expect(result.details?.knockoutExact).toEqual([
      { match_id: 'valid-r32', points: 10 },
      { match_id: 'valid-qf', points: 10 },
    ]);
    expect(result.details?.knockoutExact).not.toContainEqual({
      match_id: 'invalid-r16',
      points: 10,
    });
  });

  it('15. total equals sum of all score components', () => {
    const input = createBaseInput();
    input.matches = [
      { id: 'group-1', round: 'group', team1_id: 'g1', team2_id: 'g2' },
      { id: 'group-2', round: 'group', team1_id: 'g3', team2_id: 'g4' },
      { id: 'r32-1', round: 'round_of_32', team1_id: 'k1', team2_id: 'k2' },
      { id: 'final-1', round: 'final', team1_id: 'f1', team2_id: 'f2' },
    ];
    input.match_results = [
      { match_id: 'group-1', team1_score: 2, team2_score: 1, winner_team_id: 'g1' },
      { match_id: 'group-2', team1_score: 1, team2_score: 1, winner_team_id: null },
      { match_id: 'r32-1', team1_score: 1, team2_score: 0, winner_team_id: 'k1' },
      { match_id: 'final-1', team1_score: 3, team2_score: 1, winner_team_id: 'f1' },
    ];
    input.match_predictions = [
      { match_id: 'group-1', predicted_team1_score: 2, predicted_team2_score: 1 },
      { match_id: 'group-2', predicted_team1_score: 0, predicted_team2_score: 0 },
      {
        match_id: 'r32-1',
        predicted_team1_score: 1,
        predicted_team2_score: 0,
        predicted_winner_team_id: null,
      },
      {
        match_id: 'final-1',
        predicted_team1_score: 3,
        predicted_team2_score: 1,
        predicted_winner_team_id: null,
      },
    ];
    input.official_knockout_matchups = createKnockoutMatchups([
      { match_id: 'r32-1', team1_id: 'k1', team2_id: 'k2', winner_team_id: 'k1' },
      { match_id: 'final-1', team1_id: 'f1', team2_id: 'f2', winner_team_id: 'f1' },
    ]);
    input.predicted_knockout_matchups = createKnockoutMatchups([
      { match_id: 'r32-1', team1_id: 'k1', team2_id: 'k2' },
      { match_id: 'final-1', team1_id: 'f1', team2_id: 'f2' },
    ]);
    input.predictions_advances = [{ team_id: 'adv-1', predicted_round: 'semi_final' }];
    input.resolvedBracket = {
      champion_team_id: 'champ',
      third_place_team_id: 'third',
      official_top_scorer: 'Lionel Messi',
      official_best_goalkeeper: 'Dibu Martinez',
      team_advances: { 'adv-1': 'semi_final' },
    };
    input.predictions_specials = {
      champion_team_id: 'champ',
      third_place_team_id: 'third',
      top_scorer_name: 'Lionel Messi',
      best_goalkeeper_name: 'Dibu Martinez',
    };

    const result = calculateScore(input);

    const expectedTotal =
      result.groupStageExactPoints +
      result.groupStageOutcomePoints +
      result.knockoutExactPoints +
      result.advancementPoints +
      result.championPoints +
      result.thirdPlacePoints +
      result.topScorerPoints +
      result.bestGoalkeeperPoints;

    expect(result.groupStageExactPoints).toBe(5);
    expect(result.groupStageOutcomePoints).toBe(2);
    expect(result.knockoutExactPoints).toBe(20);
    expect(result.advancementPoints).toBe(190);
    expect(result.championPoints).toBe(150);
    expect(result.thirdPlacePoints).toBe(80);
    expect(result.topScorerPoints).toBe(60);
    expect(result.bestGoalkeeperPoints).toBe(60);
    expect(result.total).toBe(expectedTotal);
    expect(result.total).toBe(567);
  });
});
