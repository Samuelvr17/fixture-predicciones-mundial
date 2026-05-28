/**
 * Tests for manual tiebreaks normalization utility
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeManualTiebreaksFromDb,
  normalizeSingleManualTiebreakFromDb,
  separateTiebreaksByType,
  type DbManualTiebreak,
} from './manualTiebreaks';

describe('manualTiebreaks normalization', () => {
  describe('normalizeManualTiebreaksFromDb', () => {
    it('should convert group_tiebreak with single letter reference to group format', () => {
      const dbTiebreaks: DbManualTiebreak[] = [
        {
          id: '1',
          type: 'group_tiebreak',
          reference: 'E',
          ordered_team_ids: ['team1', 'team2'],
          resolved_by: 'user1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      const normalized = normalizeManualTiebreaksFromDb(dbTiebreaks);

      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toEqual({
        type: 'group',
        reference: 'group_E',
        ordered_team_ids: ['team1', 'team2'],
      });
    });

    it('should not duplicate group_ prefix if already present', () => {
      const dbTiebreaks: DbManualTiebreak[] = [
        {
          id: '1',
          type: 'group_tiebreak',
          reference: 'group_A',
          ordered_team_ids: ['team1', 'team2'],
          resolved_by: 'user1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      const normalized = normalizeManualTiebreaksFromDb(dbTiebreaks);

      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toEqual({
        type: 'group',
        reference: 'group_A',
        ordered_team_ids: ['team1', 'team2'],
      });
    });

    it('should handle best_thirds type correctly', () => {
      const dbTiebreaks: DbManualTiebreak[] = [
        {
          id: '1',
          type: 'best_thirds',
          reference: 'best_thirds',
          ordered_team_ids: ['team1', 'team2'],
          resolved_by: 'user1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      const normalized = normalizeManualTiebreaksFromDb(dbTiebreaks);

      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toEqual({
        type: 'best_thirds',
        reference: 'best_thirds',
        ordered_team_ids: ['team1', 'team2'],
      });
    });

    it('should handle mixed types correctly', () => {
      const dbTiebreaks: DbManualTiebreak[] = [
        {
          id: '1',
          type: 'group_tiebreak',
          reference: 'A',
          ordered_team_ids: ['team1', 'team2'],
          resolved_by: 'user1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: '2',
          type: 'best_thirds',
          reference: 'best_thirds',
          ordered_team_ids: ['team3', 'team4'],
          resolved_by: 'user1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: '3',
          type: 'group_tiebreak',
          reference: 'B',
          ordered_team_ids: ['team5', 'team6'],
          resolved_by: 'user1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      const normalized = normalizeManualTiebreaksFromDb(dbTiebreaks);

      expect(normalized).toHaveLength(3);
      expect(normalized[0]).toEqual({
        type: 'group',
        reference: 'group_A',
        ordered_team_ids: ['team1', 'team2'],
      });
      expect(normalized[1]).toEqual({
        type: 'best_thirds',
        reference: 'best_thirds',
        ordered_team_ids: ['team3', 'team4'],
      });
      expect(normalized[2]).toEqual({
        type: 'group',
        reference: 'group_B',
        ordered_team_ids: ['team5', 'team6'],
      });
    });

    it('should handle empty array', () => {
      const normalized = normalizeManualTiebreaksFromDb([]);
      expect(normalized).toEqual([]);
    });
  });

  describe('normalizeSingleManualTiebreakFromDb', () => {
    it('should convert single group_tiebreak to group format', () => {
      const dbTiebreak: DbManualTiebreak = {
        id: '1',
        type: 'group_tiebreak',
        reference: 'E',
        ordered_team_ids: ['team1', 'team2'],
        resolved_by: 'user1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      const normalized = normalizeSingleManualTiebreakFromDb(dbTiebreak);

      expect(normalized).toEqual({
        type: 'group',
        reference: 'group_E',
        ordered_team_ids: ['team1', 'team2'],
      });
    });

    it('should return null for unknown type', () => {
      const dbTiebreak: DbManualTiebreak = {
        id: '1',
        type: 'group_tiebreak' as any,
        reference: 'E',
        ordered_team_ids: ['team1', 'team2'],
        resolved_by: 'user1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      // Force an unknown type by modifying after creation
      const unknownType = { ...dbTiebreak, type: 'unknown' as any };
      const normalized = normalizeSingleManualTiebreakFromDb(unknownType as any);

      expect(normalized).toBeNull();
    });
  });

  describe('separateTiebreaksByType', () => {
    it('should separate group and best_thirds tiebreaks', () => {
      const normalized = [
        { type: 'group' as const, reference: 'group_A', ordered_team_ids: ['team1'] },
        { type: 'best_thirds' as const, reference: 'best_thirds', ordered_team_ids: ['team2'] },
        { type: 'group' as const, reference: 'group_B', ordered_team_ids: ['team3'] },
      ];

      const { groupTiebreaks, bestThirdsTiebreak } = separateTiebreaksByType(normalized);

      expect(groupTiebreaks).toHaveLength(2);
      expect(groupTiebreaks[0]).toEqual({
        type: 'group',
        reference: 'group_A',
        ordered_team_ids: ['team1'],
      });
      expect(groupTiebreaks[1]).toEqual({
        type: 'group',
        reference: 'group_B',
        ordered_team_ids: ['team3'],
      });

      expect(bestThirdsTiebreak).toEqual({
        type: 'best_thirds',
        reference: 'best_thirds',
        ordered_team_ids: ['team2'],
      });
    });

    it('should handle only group tiebreaks', () => {
      const normalized = [
        { type: 'group' as const, reference: 'group_A', ordered_team_ids: ['team1'] },
        { type: 'group' as const, reference: 'group_B', ordered_team_ids: ['team2'] },
      ];

      const { groupTiebreaks, bestThirdsTiebreak } = separateTiebreaksByType(normalized);

      expect(groupTiebreaks).toHaveLength(2);
      expect(bestThirdsTiebreak).toBeUndefined();
    });

    it('should handle only best_thirds tiebreak', () => {
      const normalized = [
        { type: 'best_thirds' as const, reference: 'best_thirds', ordered_team_ids: ['team1'] },
      ];

      const { groupTiebreaks, bestThirdsTiebreak } = separateTiebreaksByType(normalized);

      expect(groupTiebreaks).toHaveLength(0);
      expect(bestThirdsTiebreak).toEqual({
        type: 'best_thirds',
        reference: 'best_thirds',
        ordered_team_ids: ['team1'],
      });
    });

    it('should handle empty array', () => {
      const { groupTiebreaks, bestThirdsTiebreak } = separateTiebreaksByType([]);

      expect(groupTiebreaks).toHaveLength(0);
      expect(bestThirdsTiebreak).toBeUndefined();
    });
  });
});
