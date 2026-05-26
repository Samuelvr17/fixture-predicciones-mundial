/**
 * Unit tests for best thirds engine
 * Pure TypeScript tests without external dependencies
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBestThirds,
  TeamStats,
  ManualTiebreak,
} from './bestThirds';

function createTeamStats(
  id: string,
  points: number,
  goalDifference: number,
  goalsFor: number
): TeamStats {
  return {
    team_id: id,
    played: 3,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor,
    goalsAgainst: goalsFor - goalDifference,
    goalDifference,
    points,
  };
}

describe('bestThirds', () => {
  it('12 third-place teams without ties, qualifies top 8', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 5, 3, 6),
      createTeamStats('t4', 4, 3, 5),
      createTeamStats('t5', 4, 2, 4),
      createTeamStats('t6', 4, 1, 3),
      createTeamStats('t7', 3, 2, 4),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 2, 0, 2),
      createTeamStats('t10', 2, -1, 1),
      createTeamStats('t11', 1, -2, 1),
      createTeamStats('t12', 0, -3, 0),
    ];

    const result = calculateBestThirds(thirdPlaceTeams);

    expect(result.qualifiedThirds.length).toBe(8);
    expect(result.eliminatedThirds.length).toBe(4);
    expect(result.orderedThirds.length).toBe(12);
    expect(result.requiresManualTiebreak).toBe(false);
    expect(result.pending).toBe(false);
    expect(result.qualifiedThirds[0].team_id).toBe('t1');
    expect(result.qualifiedThirds[7].team_id).toBe('t8');
    expect(result.eliminatedThirds[0].team_id).toBe('t9');
  });

  it('tie resolved by goal difference', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 5, 3, 6),
      createTeamStats('t4', 5, 2, 6),
      createTeamStats('t5', 4, 3, 5),
      createTeamStats('t6', 4, 2, 4),
      createTeamStats('t7', 3, 2, 4),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 2, 0, 2),
      createTeamStats('t10', 2, -1, 1),
      createTeamStats('t11', 1, -2, 1),
      createTeamStats('t12', 0, -3, 0),
    ];

    const result = calculateBestThirds(thirdPlaceTeams);

    expect(result.requiresManualTiebreak).toBe(false);
    expect(result.orderedThirds[2].team_id).toBe('t3');
    expect(result.orderedThirds[3].team_id).toBe('t4');
  });

  it('tie resolved by goals scored', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 5, 3, 6),
      createTeamStats('t4', 5, 3, 5),
      createTeamStats('t5', 4, 3, 5),
      createTeamStats('t6', 4, 2, 4),
      createTeamStats('t7', 3, 2, 4),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 2, 0, 2),
      createTeamStats('t10', 2, -1, 1),
      createTeamStats('t11', 1, -2, 1),
      createTeamStats('t12', 0, -3, 0),
    ];

    const result = calculateBestThirds(thirdPlaceTeams);

    expect(result.requiresManualTiebreak).toBe(false);
    expect(result.orderedThirds[2].team_id).toBe('t3');
    expect(result.orderedThirds[3].team_id).toBe('t4');
  });

  it('tie at 8/9 cut requires manual tiebreak', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 5, 3, 6),
      createTeamStats('t4', 4, 3, 5),
      createTeamStats('t5', 4, 2, 4),
      createTeamStats('t6', 4, 1, 3),
      createTeamStats('t7', 3, 2, 4),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 3, 1, 3),
      createTeamStats('t10', 2, -1, 1),
      createTeamStats('t11', 1, -2, 1),
      createTeamStats('t12', 0, -3, 0),
    ];

    const result = calculateBestThirds(thirdPlaceTeams);

    expect(result.requiresManualTiebreak).toBe(true);
    expect(result.tiedAtCut).toContain('t8');
    expect(result.tiedAtCut).toContain('t9');
    expect(result.tiedAtCut.length).toBe(2);
  });

  it('tie within qualified doesnt block qualification', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 4, 3, 5),
      createTeamStats('t4', 4, 3, 5),
      createTeamStats('t5', 4, 2, 4),
      createTeamStats('t6', 4, 1, 3),
      createTeamStats('t7', 3, 2, 4),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 2, 0, 2),
      createTeamStats('t10', 2, -1, 1),
      createTeamStats('t11', 1, -2, 1),
      createTeamStats('t12', 0, -3, 0),
    ];

    const result = calculateBestThirds(thirdPlaceTeams);

    expect(result.requiresManualTiebreak).toBe(false);
    expect(result.tiedInsideQualified.length).toBeGreaterThan(0);
    expect(result.tiedInsideQualified[0]).toContain('t3');
    expect(result.tiedInsideQualified[0]).toContain('t4');
    expect(result.tiedAtCut.length).toBe(0);
  });

  it('tie within eliminated doesnt block qualification', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 5, 3, 6),
      createTeamStats('t4', 4, 3, 5),
      createTeamStats('t5', 4, 2, 4),
      createTeamStats('t6', 4, 1, 3),
      createTeamStats('t7', 3, 2, 4),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 2, 0, 2),
      createTeamStats('t10', 2, 0, 2),
      createTeamStats('t11', 1, -2, 1),
      createTeamStats('t12', 0, -3, 0),
    ];

    const result = calculateBestThirds(thirdPlaceTeams);

    expect(result.requiresManualTiebreak).toBe(false);
    expect(result.tiedInsideEliminated.length).toBeGreaterThan(0);
    expect(result.tiedInsideEliminated[0]).toContain('t9');
    expect(result.tiedInsideEliminated[0]).toContain('t10');
    expect(result.tiedAtCut.length).toBe(0);
  });

  it('fewer than 12 third-place teams returns pending', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 5, 3, 6),
      createTeamStats('t4', 4, 3, 5),
    ];

    const result = calculateBestThirds(thirdPlaceTeams);

    expect(result.pending).toBe(true);
    expect(result.qualifiedThirds.length).toBe(0);
    expect(result.eliminatedThirds.length).toBe(0);
    expect(result.requiresManualTiebreak).toBe(false);
    expect(result.orderedThirds.length).toBe(4);
  });

  it('multiple tie crossing the cut requires manual tiebreak', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 4, 3, 5),
      createTeamStats('t4', 4, 2, 4),
      createTeamStats('t5', 4, 1, 3),
      createTeamStats('t6', 3, 2, 4),
      createTeamStats('t7', 3, 1, 3),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 3, 1, 3),
      createTeamStats('t10', 3, 1, 3),
      createTeamStats('t11', 1, -2, 1),
      createTeamStats('t12', 0, -3, 0),
    ];

    const result = calculateBestThirds(thirdPlaceTeams);

    expect(result.requiresManualTiebreak).toBe(true);
    expect(result.tiedAtCut).toContain('t7');
    expect(result.tiedAtCut).toContain('t8');
    expect(result.tiedAtCut).toContain('t9');
    expect(result.tiedAtCut).toContain('t10');
    expect(result.tiedAtCut.length).toBe(4);
  });

  it('manual tiebreak is applied when provided', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 5, 3, 6),
      createTeamStats('t4', 4, 3, 5),
      createTeamStats('t5', 4, 2, 4),
      createTeamStats('t6', 4, 1, 3),
      createTeamStats('t7', 3, 2, 4),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 3, 1, 3),
      createTeamStats('t10', 2, -1, 1),
      createTeamStats('t11', 1, -2, 1),
      createTeamStats('t12', 0, -3, 0),
    ];

    const manualTiebreak: ManualTiebreak = {
      type: 'best_thirds',
      reference: 'best_thirds_2026',
      ordered_team_ids: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12'],
    };

    const result = calculateBestThirds(thirdPlaceTeams, manualTiebreak);

    expect(result.requiresManualTiebreak).toBe(false);
    expect(result.orderedThirds[7].team_id).toBe('t8');
    expect(result.orderedThirds[8].team_id).toBe('t9');
  });
});
