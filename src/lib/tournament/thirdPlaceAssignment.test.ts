/**
 * Unit tests for third-place assignment engine
 * Pure TypeScript tests without external dependencies
 */

import { describe, it, expect } from 'vitest';
import {
  assignThirdPlaceSlots,
  getAllSlotPatterns,
  hasCombination,
  GroupCode,
  SlotPattern,
} from './thirdPlaceAssignment';

describe('thirdPlaceAssignment', () => {
  describe('validation', () => {
    it('fails if there are fewer than 8 groups', () => {
      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toThrow(
        'Expected exactly 8 qualified third-place groups, got 7'
      );

      expect(() => assignThirdPlaceSlots(['A', 'B', 'C'])).toThrow(
        'Expected exactly 8 qualified third-place groups, got 3'
      );
    });

    it('fails if there are duplicate groups', () => {
      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'])).toThrow(
        'Duplicate group codes detected'
      );

      expect(() => assignThirdPlaceSlots(['A', 'A', 'B', 'C', 'D', 'E', 'F', 'G'])).toThrow(
        'Duplicate group codes detected'
      );
    });

    it('fails if there is an invalid group', () => {
      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'M'])).toThrow(
        'Invalid group code: M'
      );

      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'Z'])).toThrow(
        'Invalid group code: Z'
      );

      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', '1'])).toThrow(
        'Invalid group code: 1'
      );
    });

    it('fails if the combination does not exist in the table', () => {
      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])).toThrow(
        'not found in official table'
      );

      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I'])).toThrow(
        'not found in official table'
      );
    });
  });

  describe('slot patterns', () => {
    it('returns all 8 slot patterns', () => {
      const allPatterns = getAllSlotPatterns();
      expect(allPatterns.length).toBe(8);

      const expectedPatterns: SlotPattern[] = [
        '3A/B/C/D/F',
        '3C/D/F/G/H',
        '3C/E/F/H/I',
        '3E/H/I/J/K',
        '3B/E/F/I/J',
        '3A/E/H/I/J',
        '3E/F/G/I/J',
        '3D/E/I/J/L',
      ];

      expect(allPatterns).toEqual(expectedPatterns);
    });
  });

  describe('hasCombination helper', () => {
    it('returns false for invalid input', () => {
      expect(hasCombination(['A', 'B', 'C'])).toBe(false);
      expect(hasCombination(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'M'])).toBe(false);
      expect(hasCombination(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'])).toBe(false);
    });

    it('returns false for valid but not-in-table combinations', () => {
      expect(hasCombination(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])).toBe(false);
    });
  });

  describe('normalization', () => {
    it('normalizes group codes to uppercase', () => {
      expect(() => assignThirdPlaceSlots(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])).toThrow(
        'not found in official table'
      );
    });

    it('handles mixed case input', () => {
      expect(() => assignThirdPlaceSlots(['a', 'B', 'c', 'D', 'e', 'F', 'g', 'H'])).toThrow(
        'not found in official table'
      );
    });
  });

  describe('table incomplete behavior', () => {
    it('throws error when table is incomplete', () => {
      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])).toThrow(
        'not found in official table'
      );
    });
  });
});
