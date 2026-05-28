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
      // All C(12,8) = 495 combinations are valid in the official table
      // This test is no longer applicable since the table is complete
      // Invalid inputs are tested separately
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

    it('returns true for valid combinations in the table', () => {
      expect(hasCombination(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'])).toBe(true);
      expect(hasCombination(['D', 'F', 'G', 'H', 'I', 'J', 'K', 'L'])).toBe(true);
    });
  });

  describe('normalization', () => {
    it('normalizes group codes to uppercase and resolves valid combinations', () => {
      // abcdefgh normalizes to ABCDEFGH which is a valid combination
      const result = assignThirdPlaceSlots(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
      expect(result.assignments).toBeDefined();
      expect(Object.keys(result.assignments)).toHaveLength(8);
    });

    it('handles mixed case input for valid combinations', () => {
      // aBcDeFgH normalizes to ABCDEFGH which is valid
      const result = assignThirdPlaceSlots(['a', 'B', 'c', 'D', 'e', 'F', 'g', 'H']);
      expect(result.assignments).toBeDefined();
      expect(Object.keys(result.assignments)).toHaveLength(8);
    });
  });

  describe('real combination EFGHIJKL (Option 1)', () => {
    it('hasCombination returns true for EFGHIJKL', () => {
      expect(hasCombination(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'])).toBe(true);
    });

    it('assignThirdPlaceSlots returns correct mapping for EFGHIJKL', () => {
      const result = assignThirdPlaceSlots(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
      
      expect(result.assignments).toEqual({
        '3A/B/C/D/F': 'F',
        '3C/D/F/G/H': 'G',
        '3C/E/F/H/I': 'E',
        '3E/H/I/J/K': 'K',
        '3B/E/F/I/J': 'I',
        '3A/E/H/I/J': 'H',
        '3E/F/G/I/J': 'J',
        '3D/E/I/J/L': 'L',
      });
    });

    it('assignThirdPlaceSlots is order-independent', () => {
      const result1 = assignThirdPlaceSlots(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
      const result2 = assignThirdPlaceSlots(['L', 'K', 'J', 'I', 'H', 'G', 'F', 'E']);
      const result3 = assignThirdPlaceSlots(['K', 'E', 'G', 'I', 'F', 'H', 'J', 'L']);
      
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe('integrity tests', () => {
    it('has exactly 495 combinations available', () => {
      // Generate all C(12, 8) = 495 combinations
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      const allCombinations: string[][] = [];
      
      function generateCombinations(start: number, current: string[]): void {
        if (current.length === 8) {
          allCombinations.push([...current]);
          return;
        }
        
        for (let i = start; i < letters.length; i++) {
          generateCombinations(i + 1, [...current, letters[i]]);
        }
      }
      
      generateCombinations(0, []);
      
      expect(allCombinations.length).toBe(495);
    });

    it('all 495 combinations are reachable with hasCombination', () => {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      let reachableCount = 0;
      
      function generateCombinations(start: number, current: string[]): void {
        if (current.length === 8) {
          if (hasCombination(current)) {
            reachableCount++;
          }
          return;
        }
        
        for (let i = start; i < letters.length; i++) {
          generateCombinations(i + 1, [...current, letters[i]]);
        }
      }
      
      generateCombinations(0, []);
      
      expect(reachableCount).toBe(495);
    });
  });

  describe('still rejects invalid inputs', () => {
    it('rejects fewer than 8 groups', () => {
      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toThrow(
        'Expected exactly 8 qualified third-place groups'
      );
    });

    it('rejects more than 8 groups', () => {
      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])).toThrow(
        'Expected exactly 8 qualified third-place groups'
      );
    });

    it('rejects duplicate groups', () => {
      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'])).toThrow(
        'Duplicate group codes detected'
      );
    });

    it('rejects invalid group codes', () => {
      expect(() => assignThirdPlaceSlots(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'M'])).toThrow(
        'Invalid group code: M'
      );
    });

    it('rejects impossible combinations', () => {
      // All C(12,8) = 495 combinations are valid in the official table
      // There are no "impossible" combinations with 8 valid distinct group codes
      // Invalid inputs are tested separately above
    });
  });
});
