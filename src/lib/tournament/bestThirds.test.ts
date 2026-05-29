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

  it('manual tiebreak only reorders the tied block at the cut', () => {
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

    // Manual tiebreak only for the tied block (t8, t9)
    const manualTiebreak: ManualTiebreak = {
      type: 'best_thirds',
      reference: 'best_thirds_2026',
      ordered_team_ids: ['t9', 't8'],
    };

    const result = calculateBestThirds(thirdPlaceTeams, manualTiebreak);

    expect(result.requiresManualTiebreak).toBe(false);
    // Teams with better stats should remain in their positions
    expect(result.orderedThirds[0].team_id).toBe('t1');
    expect(result.orderedThirds[1].team_id).toBe('t2');
    expect(result.orderedThirds[2].team_id).toBe('t3');
    expect(result.orderedThirds[3].team_id).toBe('t4');
    expect(result.orderedThirds[4].team_id).toBe('t5');
    expect(result.orderedThirds[5].team_id).toBe('t6');
    expect(result.orderedThirds[6].team_id).toBe('t7');
    // t9 should be before t8 due to manual tiebreak
    expect(result.orderedThirds[7].team_id).toBe('t9');
    expect(result.orderedThirds[8].team_id).toBe('t8');
    expect(result.orderedThirds[9].team_id).toBe('t10');
    expect(result.orderedThirds[10].team_id).toBe('t11');
    expect(result.orderedThirds[11].team_id).toBe('t12');
  });

  it('manual tiebreak with 6 teams at 4 pts and 6 teams at 3 pts tied', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 4, 5, 8),   // 4 pts
      createTeamStats('t2', 4, 4, 7),   // 4 pts
      createTeamStats('t3', 4, 3, 6),   // 4 pts
      createTeamStats('t4', 4, 2, 5),   // 4 pts
      createTeamStats('t5', 4, 1, 4),   // 4 pts
      createTeamStats('t6', 4, 0, 3),   // 4 pts
      createTeamStats('t7', 3, 1, 3),   // 3 pts - tied
      createTeamStats('t8', 3, 1, 3),   // 3 pts - tied
      createTeamStats('t9', 3, 1, 3),   // 3 pts - tied
      createTeamStats('t10', 3, 1, 3),  // 3 pts - tied
      createTeamStats('t11', 3, 1, 3),  // 3 pts - tied
      createTeamStats('t12', 3, 1, 3),  // 3 pts - tied
    ];

    // Manual tiebreak for the 6 teams with 3 pts
    const manualTiebreak: ManualTiebreak = {
      type: 'best_thirds',
      reference: 'best_thirds',
      ordered_team_ids: ['t12', 't9', 't10', 't11', 't8', 't7'],
    };

    const result = calculateBestThirds(thirdPlaceTeams, manualTiebreak);

    // The 6 teams with 4 pts must be in positions 0-5
    expect(result.orderedThirds[0].points).toBe(4);
    expect(result.orderedThirds[1].points).toBe(4);
    expect(result.orderedThirds[2].points).toBe(4);
    expect(result.orderedThirds[3].points).toBe(4);
    expect(result.orderedThirds[4].points).toBe(4);
    expect(result.orderedThirds[5].points).toBe(4);

    // t12 should be at position 6 (first of the 3-pt block)
    expect(result.orderedThirds[6].team_id).toBe('t12');
    expect(result.orderedThirds[6].points).toBe(3);

    // t9 should be at position 7 (second of the 3-pt block, qualified)
    expect(result.orderedThirds[7].team_id).toBe('t9');
    expect(result.orderedThirds[7].points).toBe(3);

    // The rest should be 3 pts teams in manual order
    expect(result.orderedThirds[8].points).toBe(3);
    expect(result.orderedThirds[9].points).toBe(3);
    expect(result.orderedThirds[10].points).toBe(3);
    expect(result.orderedThirds[11].points).toBe(3);

    // No 3-pt team should be above a 4-pt team
    for (let i = 0; i < 6; i++) {
      expect(result.orderedThirds[i].points).toBe(4);
    }
  });

  it('manual tiebreak cannot break points order - 3 pts cannot jump above 4 pts', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 4, 5, 8),
      createTeamStats('t2', 4, 4, 7),
      createTeamStats('t3', 4, 3, 6),
      createTeamStats('t4', 4, 2, 5),
      createTeamStats('t5', 4, 1, 4),
      createTeamStats('t6', 4, 0, 3),
      createTeamStats('t7', 3, 2, 4),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 3, 1, 3),
      createTeamStats('t10', 2, 0, 2),
      createTeamStats('t11', 1, -1, 1),
      createTeamStats('t12', 0, -2, 0),
    ];

    // Manual tiebreak tries to put 3-pt teams before 4-pt teams
    const manualTiebreak: ManualTiebreak = {
      type: 'best_thirds',
      reference: 'best_thirds',
      ordered_team_ids: ['t7', 't8', 't9', 't1', 't2', 't3', 't4', 't5', 't6', 't10', 't11', 't12'],
    };

    const result = calculateBestThirds(thirdPlaceTeams, manualTiebreak);

    // Despite the manual tiebreak attempting to reorder globally, 4-pt teams must stay on top
    for (let i = 0; i < 6; i++) {
      expect(result.orderedThirds[i].points).toBe(4);
    }

    // 3-pt teams must be after 4-pt teams
    for (let i = 6; i < 9; i++) {
      expect(result.orderedThirds[i].points).toBe(3);
    }
  });

  it('partial manual tiebreak - only some teams in the block are specified', () => {
    const thirdPlaceTeams: TeamStats[] = [
      createTeamStats('t1', 6, 5, 8),
      createTeamStats('t2', 5, 4, 7),
      createTeamStats('t3', 5, 3, 6),
      createTeamStats('t4', 4, 3, 5),
      createTeamStats('t5', 4, 2, 4),
      createTeamStats('t6', 4, 1, 3),
      createTeamStats('t7', 3, 1, 3),
      createTeamStats('t8', 3, 1, 3),
      createTeamStats('t9', 3, 1, 3),
      createTeamStats('t10', 3, 1, 3),
      createTeamStats('t11', 2, -1, 1),
      createTeamStats('t12', 0, -3, 0),
    ];

    // Manual tiebreak only specifies 2 of the 4 tied teams
    const manualTiebreak: ManualTiebreak = {
      type: 'best_thirds',
      reference: 'best_thirds',
      ordered_team_ids: ['t9', 't8'],
    };

    const result = calculateBestThirds(thirdPlaceTeams, manualTiebreak);

    // Partial manual tiebreak should not be applied since it doesn't cover all tied teams
    expect(result.requiresManualTiebreak).toBe(true);

    // Order should remain automatic (original sorted order)
    expect(result.orderedThirds[0].team_id).toBe('t1');
    expect(result.orderedThirds[1].team_id).toBe('t2');
    expect(result.orderedThirds[2].team_id).toBe('t3');
    expect(result.orderedThirds[3].team_id).toBe('t4');
    expect(result.orderedThirds[4].team_id).toBe('t5');
    expect(result.orderedThirds[5].team_id).toBe('t6');

    // Tied teams remain in their original order (t7, t8, t9, t10)
    expect(result.orderedThirds[6].team_id).toBe('t7');
    expect(result.orderedThirds[7].team_id).toBe('t8');
    expect(result.orderedThirds[8].team_id).toBe('t9');
    expect(result.orderedThirds[9].team_id).toBe('t10');

    // Teams after the tied block should not move
    expect(result.orderedThirds[10].team_id).toBe('t11');
    expect(result.orderedThirds[11].team_id).toBe('t12');
  });

  it('manual tiebreak with no tiedAtCut should not change automatic order', () => {
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

    // Manual tiebreak provided but no tie at cut
    const manualTiebreak: ManualTiebreak = {
      type: 'best_thirds',
      reference: 'best_thirds',
      ordered_team_ids: ['t12', 't11', 't10', 't9', 't8', 't7', 't6', 't5', 't4', 't3', 't2', 't1'],
    };

    const result = calculateBestThirds(thirdPlaceTeams, manualTiebreak);

    // Since there's no tie at cut, manual tiebreak should not change the automatic order
    expect(result.requiresManualTiebreak).toBe(false);
    expect(result.orderedThirds[0].team_id).toBe('t1');
    expect(result.orderedThirds[1].team_id).toBe('t2');
    expect(result.orderedThirds[2].team_id).toBe('t3');
    expect(result.orderedThirds[3].team_id).toBe('t4');
    expect(result.orderedThirds[4].team_id).toBe('t5');
    expect(result.orderedThirds[5].team_id).toBe('t6');
    expect(result.orderedThirds[6].team_id).toBe('t7');
    expect(result.orderedThirds[7].team_id).toBe('t8');
    expect(result.orderedThirds[8].team_id).toBe('t9');
    expect(result.orderedThirds[9].team_id).toBe('t10');
    expect(result.orderedThirds[10].team_id).toBe('t11');
    expect(result.orderedThirds[11].team_id).toBe('t12');
  });

  it('manual tiebreak with ids outside the tied block are ignored', () => {
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

    // Manual tiebreak includes ids outside the tied block (t1, t2, t3 are not tied)
    const manualTiebreak: ManualTiebreak = {
      type: 'best_thirds',
      reference: 'best_thirds',
      ordered_team_ids: ['t1', 't2', 't3', 't9', 't8'],
    };

    const result = calculateBestThirds(thirdPlaceTeams, manualTiebreak);

    // Teams outside the tied block should not be affected by manual tiebreak
    expect(result.orderedThirds[0].team_id).toBe('t1');
    expect(result.orderedThirds[1].team_id).toBe('t2');
    expect(result.orderedThirds[2].team_id).toBe('t3');
    expect(result.orderedThirds[3].team_id).toBe('t4');
    expect(result.orderedThirds[4].team_id).toBe('t5');
    expect(result.orderedThirds[5].team_id).toBe('t6');
    expect(result.orderedThirds[6].team_id).toBe('t7');

    // Only the tied block should be reordered
    expect(result.orderedThirds[7].team_id).toBe('t9');
    expect(result.orderedThirds[8].team_id).toBe('t8');

    // The rest should remain in automatic order
    expect(result.orderedThirds[9].team_id).toBe('t10');
    expect(result.orderedThirds[10].team_id).toBe('t11');
    expect(result.orderedThirds[11].team_id).toBe('t12');
  });
});
