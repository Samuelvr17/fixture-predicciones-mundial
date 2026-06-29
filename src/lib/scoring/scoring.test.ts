/**
 * src/lib/scoring/scoring.test.ts
 *
 * Unit tests for the scoring engine
 */

import { describe, it, expect } from 'vitest';
import {
  calculateScore,
  evaluateKnockoutExactAward,
  normalizeString,
  type CalculateScoreInput,
  type KnockoutMatchup,
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

describe('normalizeString', () => {
  it('should trim, lowercase, remove accents, and collapse spaces', () => {
    expect(normalizeString('  Lionel MESSI  ')).toBe('lionel messi');
    expect(normalizeString('Ángel Di María')).toBe('angel di maria');
    expect(normalizeString('Kylian  Mbappé')).toBe('kylian mbappe');
  });
});

describe('calculateScore', () => {
  const createBaseInput = (): CalculateScoreInput => ({
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
  });

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
