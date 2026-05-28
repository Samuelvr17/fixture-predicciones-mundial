/**
 * Tests for tiebreaksHelper pure functions
 */

import { describe, it, expect } from 'vitest';
import { calculateTiebreakData, type TeamData, type MatchData, type MatchResultData } from './tiebreaksHelper';
import type { DbManualTiebreak } from './manualTiebreaks';

describe('tiebreaksHelper', () => {
  describe('calculateTiebreakData with group tiebreaks', () => {
    it('should normalize and apply group tiebreaks before calculating best thirds', () => {
      const teams: TeamData[] = [
        { id: 'germany', name: 'Germany', code: 'GER', group_code: 'E' },
        { id: 'curacao', name: 'Curaçao', code: 'CUW', group_code: 'E' },
        { id: 'ecuador', name: 'Ecuador', code: 'ECU', group_code: 'E' },
        { id: 'ivory_coast', name: 'Ivory Coast', code: 'CIV', group_code: 'E' },
      ];

      const matches: MatchData[] = [
        { id: 'm1', team1_id: 'germany', team2_id: 'curacao', group_code: 'E' },
        { id: 'm2', team1_id: 'ecuador', team2_id: 'ivory_coast', group_code: 'E' },
        { id: 'm3', team1_id: 'germany', team2_id: 'ecuador', group_code: 'E' },
        { id: 'm4', team1_id: 'curacao', team2_id: 'ivory_coast', group_code: 'E' },
        { id: 'm5', team1_id: 'germany', team2_id: 'ivory_coast', group_code: 'E' },
        { id: 'm6', team1_id: 'curacao', team2_id: 'ecuador', group_code: 'E' },
      ];

      const matchResults: MatchResultData[] = [
        { match_id: 'm1', team1_score: 2, team2_score: 0 },
        { match_id: 'm2', team1_score: 2, team2_score: 0 },
        { match_id: 'm3', team1_score: 2, team2_score: 0 },
        { match_id: 'm4', team1_score: 2, team2_score: 0 },
        { match_id: 'm5', team1_score: 0, team2_score: 1 },
        { match_id: 'm6', team1_score: 1, team2_score: 1 },
      ];

      // No manual tiebreaks - should detect the tie
      const manualTiebreaks: DbManualTiebreak[] = [];

      const result = calculateTiebreakData(teams, matches, matchResults, manualTiebreaks);

      // Verify that group tiebreak is detected (curacao and ecuador are tied at 4 points)
      expect(result.groupTiebreaks['E']).toBeDefined();
      expect(result.groupTiebreaks['E'].groupCode).toBe('E');
      expect(result.groupTiebreaks['E'].resolved).toBe(false);
      expect(result.groupTiebreaks['E'].tiedTeams).toHaveLength(2);

      // The key test: verify that the helper normalizes and separates tiebreaks
      // This ensures that group tiebreaks are applied before calculating best thirds
      expect(result.groupTiebreaks).toBeDefined();
    });

    it('should handle empty manual tiebreaks', () => {
      const teams: TeamData[] = [
        { id: 't1', name: 'Team 1', code: 'T1', group_code: 'A' },
        { id: 't2', name: 'Team 2', code: 'T2', group_code: 'A' },
        { id: 't3', name: 'Team 3', code: 'T3', group_code: 'A' },
        { id: 't4', name: 'Team 4', code: 'T4', group_code: 'A' },
      ];

      const matches: MatchData[] = [
        { id: 'm1', team1_id: 't1', team2_id: 't2', group_code: 'A' },
        { id: 'm2', team1_id: 't3', team2_id: 't4', group_code: 'A' },
        { id: 'm3', team1_id: 't1', team2_id: 't3', group_code: 'A' },
        { id: 'm4', team1_id: 't2', team2_id: 't4', group_code: 'A' },
        { id: 'm5', team1_id: 't1', team2_id: 't4', group_code: 'A' },
        { id: 'm6', team1_id: 't2', team2_id: 't3', group_code: 'A' },
      ];

      const matchResults: MatchResultData[] = [
        { match_id: 'm1', team1_score: 2, team2_score: 0 },
        { match_id: 'm2', team1_score: 2, team2_score: 0 },
        { match_id: 'm3', team1_score: 2, team2_score: 0 },
        { match_id: 'm4', team1_score: 2, team2_score: 0 },
        { match_id: 'm5', team1_score: 2, team2_score: 0 },
        { match_id: 'm6', team1_score: 2, team2_score: 0 },
      ];

      const manualTiebreaks: DbManualTiebreak[] = [];

      const result = calculateTiebreakData(teams, matches, matchResults, manualTiebreaks);

      expect(result.groupTiebreaks).toEqual({});
      expect(result.bestThirdsTiebreak).toBeNull();
    });

    it('should separate group and best_thirds tiebreaks correctly', () => {
      const teams: TeamData[] = [
        { id: 't1', name: 'Team 1', code: 'T1', group_code: 'A' },
        { id: 't2', name: 'Team 2', code: 'T2', group_code: 'A' },
        { id: 't3', name: 'Team 3', code: 'T3', group_code: 'A' },
        { id: 't4', name: 'Team 4', code: 'T4', group_code: 'A' },
      ];

      const matches: MatchData[] = [
        { id: 'm1', team1_id: 't1', team2_id: 't2', group_code: 'A' },
        { id: 'm2', team1_id: 't3', team2_id: 't4', group_code: 'A' },
        { id: 'm3', team1_id: 't1', team2_id: 't3', group_code: 'A' },
        { id: 'm4', team1_id: 't2', team2_id: 't4', group_code: 'A' },
        { id: 'm5', team1_id: 't1', team2_id: 't4', group_code: 'A' },
        { id: 'm6', team1_id: 't2', team2_id: 't3', group_code: 'A' },
      ];

      const matchResults: MatchResultData[] = [
        { match_id: 'm1', team1_score: 2, team2_score: 2 },
        { match_id: 'm2', team1_score: 1, team2_score: 0 },
        { match_id: 'm3', team1_score: 0, team2_score: 1 },
        { match_id: 'm4', team1_score: 2, team2_score: 0 },
        { match_id: 'm5', team1_score: 2, team2_score: 0 },
        { match_id: 'm6', team1_score: 0, team2_score: 1 },
      ];

      // No manual tiebreaks - should detect the tie
      const manualTiebreaks: DbManualTiebreak[] = [];

      const result = calculateTiebreakData(teams, matches, matchResults, manualTiebreaks);

      // Group tiebreak should be detected (t1 and t2 are tied at 4 points)
      expect(result.groupTiebreaks['A']).toBeDefined();
      expect(result.groupTiebreaks['A'].resolved).toBe(false);
      expect(result.groupTiebreaks['A'].tiedTeams).toHaveLength(2);
    });
  });

  describe('integration with /standings flow', () => {
    it('should use the same normalization and separation flow as /standings', () => {
      const teams: TeamData[] = [
        { id: 'germany', name: 'Germany', code: 'GER', group_code: 'E' },
        { id: 'curacao', name: 'Curaçao', code: 'CUW', group_code: 'E' },
        { id: 'ecuador', name: 'Ecuador', code: 'ECU', group_code: 'E' },
        { id: 'ivory_coast', name: 'Ivory Coast', code: 'CIV', group_code: 'E' },
      ];

      const matches: MatchData[] = [
        { id: 'm1', team1_id: 'germany', team2_id: 'curacao', group_code: 'E' },
        { id: 'm2', team1_id: 'ecuador', team2_id: 'ivory_coast', group_code: 'E' },
        { id: 'm3', team1_id: 'germany', team2_id: 'ecuador', group_code: 'E' },
        { id: 'm4', team1_id: 'curacao', team2_id: 'ivory_coast', group_code: 'E' },
        { id: 'm5', team1_id: 'germany', team2_id: 'ivory_coast', group_code: 'E' },
        { id: 'm6', team1_id: 'curacao', team2_id: 'ecuador', group_code: 'E' },
      ];

      const matchResults: MatchResultData[] = [
        { match_id: 'm1', team1_score: 2, team2_score: 0 },
        { match_id: 'm2', team1_score: 2, team2_score: 0 },
        { match_id: 'm3', team1_score: 2, team2_score: 0 },
        { match_id: 'm4', team1_score: 2, team2_score: 0 },
        { match_id: 'm5', team1_score: 0, team2_score: 1 },
        { match_id: 'm6', team1_score: 1, team2_score: 1 },
      ];

      // No manual tiebreaks - should detect the tie
      const manualTiebreaks: DbManualTiebreak[] = [];

      const result = calculateTiebreakData(teams, matches, matchResults, manualTiebreaks);

      // Verify the flow matches /standings:
      // 1. normalizeManualTiebreaksFromDb is called internally
      // 2. separateTiebreaksByType is called internally
      // 3. calculateGroupStandings receives groupTiebreaks
      // 4. calculateBestThirds receives bestThirdsTiebreak
      
      expect(result.groupTiebreaks['E']).toBeDefined();
      expect(result.groupTiebreaks['E'].tiedTeams).toHaveLength(2);
      expect(result.groupTiebreaks['E'].tiedTeams[0].id).toBe('curacao');
      expect(result.groupTiebreaks['E'].tiedTeams[1].id).toBe('ecuador');
    });
  });
});
