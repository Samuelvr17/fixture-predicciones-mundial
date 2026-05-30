/**
 * Tests for bracket.ts
 * Pure TypeScript engine for resolving the global official bracket
 */

import { describe, it, expect } from 'vitest';
import { 
  resolveBracket, 
  Match, 
  MatchResult, 
  GroupStandingsOutput, 
  BestThirdsOutput,
  Slot
} from './bracket';
import { TeamStats } from './groupStandings';
import { hasCombination } from './thirdPlaceAssignment';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockGroupStandings(): GroupStandingsOutput {
  return {
    standings: {
      'A': {
        group_code: 'A',
        standings: [
          { team_id: 'mexico', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 7 },
          { team_id: 'south_korea', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
          { team_id: 'czech_republic', played: 3, wins: 0, draws: 2, losses: 1, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 2 },
          { team_id: 'south_africa', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 1, goalsAgainst: 4, goalDifference: -3, points: 1 },
        ],
        requiresManualTiebreak: false,
        tiedTeams: [],
      },
      'B': {
        group_code: 'B',
        standings: [
          { team_id: 'canada', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 4, goalsAgainst: 1, goalDifference: 3, points: 7 },
          { team_id: 'switzerland', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
          { team_id: 'bosnia', played: 3, wins: 0, draws: 2, losses: 1, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 2 },
          { team_id: 'qatar', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 1, goalsAgainst: 3, goalDifference: -2, points: 1 },
        ],
        requiresManualTiebreak: false,
        tiedTeams: [],
      },
    },
    thirdPlaceTeams: [],
    requiresManualTiebreak: false,
  };
}

function createMockBestThirds(): BestThirdsOutput {
  return {
    qualifiedThirds: [],
    eliminatedThirds: [],
    orderedThirds: [],
    requiresManualTiebreak: false,
    pending: true,
    tiedInsideQualified: [],
    tiedInsideEliminated: [],
    tiedAtCut: [],
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('bracket.ts', () => {
  describe('keeps slots pending until official group standings are complete', () => {
    it('should not resolve 1A from incomplete Group A standings', () => {
      const matches: Match[] = [
        {
          id: 'match-73',
          num: 73,
          round: 'round_of_32',
          date: '2026-06-28',
          time: '12:00 UTC-7',
          ground: 'Los Angeles',
          team1_slot: '1A',
          team2_slot: '2B',
        },
      ];

      const groupStandings = createMockGroupStandings();
      groupStandings.standings.A.standings = groupStandings.standings.A.standings.map((team) => ({
        ...team,
        played: 1,
      }));
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, [], groupStandings, bestThirds);

      expect(result.matches[0].team1_id).toBeUndefined();
      expect(result.matches[0].team1_slot).toBe('1A');
      expect(result.matches[0].pendingSlots[0]).toEqual({ slot: '1A', reason: 'incomplete_group' });
    });

    it('should not resolve third-place slots until every group is complete', () => {
      const matches: Match[] = [
        {
          id: 'match-73',
          num: 73,
          round: 'round_of_32',
          date: '2026-06-28',
          time: '12:00 UTC-7',
          ground: 'Los Angeles',
          team1_slot: '3A/B',
          team2_slot: '1B',
        },
      ];

      const groupStandings = createMockGroupStandings();
      groupStandings.standings.A.standings = groupStandings.standings.A.standings.map((team) => ({
        ...team,
        played: 1,
      }));
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, [], groupStandings, bestThirds);

      expect(result.matches[0].team1_id).toBeUndefined();
      expect(result.matches[0].team1_slot).toBe('3A/B');
      expect(result.matches[0].pendingSlots[0]).toEqual({ slot: '3A/B', reason: 'incomplete_group' });
    });
  });

  describe('resolves 1A and 2A from standings', () => {
    it('should resolve 1A to first place team in Group A', () => {
      const matches: Match[] = [
        {
          id: 'match-73',
          num: 73,
          round: 'round_of_32',
          date: '2026-06-28',
          time: '12:00 UTC-7',
          ground: 'Los Angeles',
          team1_slot: '1A',
          team2_slot: '2B',
        },
      ];

      const matchResults: MatchResult[] = [];
      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[0].team1_id).toBe('mexico');
      expect(result.matches[0].pendingSlots).toHaveLength(0);
    });

    it('should resolve 2A to second place team in Group A', () => {
      const matches: Match[] = [
        {
          id: 'match-73',
          num: 73,
          round: 'round_of_32',
          date: '2026-06-28',
          time: '12:00 UTC-7',
          ground: 'Los Angeles',
          team1_slot: '2A',
          team2_slot: '1B',
        },
      ];

      const matchResults: MatchResult[] = [];
      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[0].team1_id).toBe('south_korea');
      expect(result.matches[0].pendingSlots).toHaveLength(0);
    });
  });

  describe('resolves third place slot with real Annex C combination', () => {
    it('should resolve 3A/B/C/D/F to third place of Group F for EFGHIJKL combination', () => {
      // Create group standings with third place teams in E, F, G, H, I, J, K, L
      const groupStandings: GroupStandingsOutput = {
        standings: {
          'E': {
            group_code: 'E',
            standings: [
              { team_id: 'team_e1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 7 },
              { team_id: 'team_e2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
              { team_id: 'team_e3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 }, // Third place
            ],
            requiresManualTiebreak: false,
            tiedTeams: [],
          },
          'F': {
            group_code: 'F',
            standings: [
              { team_id: 'team_f1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 7 },
              { team_id: 'team_f2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
              { team_id: 'team_f3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 }, // Third place
            ],
            requiresManualTiebreak: false,
            tiedTeams: [],
          },
          'G': {
            group_code: 'G',
            standings: [
              { team_id: 'team_g1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 7 },
              { team_id: 'team_g2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
              { team_id: 'team_g3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 }, // Third place
            ],
            requiresManualTiebreak: false,
            tiedTeams: [],
          },
          'H': {
            group_code: 'H',
            standings: [
              { team_id: 'team_h1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 7 },
              { team_id: 'team_h2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
              { team_id: 'team_h3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 }, // Third place
            ],
            requiresManualTiebreak: false,
            tiedTeams: [],
          },
          'I': {
            group_code: 'I',
            standings: [
              { team_id: 'team_i1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 7 },
              { team_id: 'team_i2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
              { team_id: 'team_i3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 }, // Third place
            ],
            requiresManualTiebreak: false,
            tiedTeams: [],
          },
          'J': {
            group_code: 'J',
            standings: [
              { team_id: 'team_j1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 7 },
              { team_id: 'team_j2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
              { team_id: 'team_j3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 }, // Third place
            ],
            requiresManualTiebreak: false,
            tiedTeams: [],
          },
          'K': {
            group_code: 'K',
            standings: [
              { team_id: 'team_k1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 7 },
              { team_id: 'team_k2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
              { team_id: 'team_k3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 }, // Third place
            ],
            requiresManualTiebreak: false,
            tiedTeams: [],
          },
          'L': {
            group_code: 'L',
            standings: [
              { team_id: 'team_l1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 7 },
              { team_id: 'team_l2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 5 },
              { team_id: 'team_l3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 }, // Third place
            ],
            requiresManualTiebreak: false,
            tiedTeams: [],
          },
        },
        thirdPlaceTeams: [],
        requiresManualTiebreak: false,
      };

      // Create bestThirds with qualified thirds from E, F, G, H, I, J, K, L
      const bestThirds: BestThirdsOutput = {
        qualifiedThirds: [
          { team_id: 'team_e3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_f3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_g3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_h3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_i3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_j3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_k3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_l3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
        ],
        eliminatedThirds: [],
        orderedThirds: [],
        requiresManualTiebreak: false,
        pending: false,
        tiedInsideQualified: [],
        tiedInsideEliminated: [],
        tiedAtCut: [],
      };

      const matches: Match[] = [
        {
          id: 'match-74',
          num: 74,
          round: 'round_of_32',
          date: '2026-06-29',
          time: '16:30 UTC-4',
          ground: 'Boston',
          team1_id: 'germany',
          team2_slot: '3A/B/C/D/F',
        },
      ];

      const matchResults: MatchResult[] = [];

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      // Option 1 assigns F to slot 3A/B/C/D/F (rival of 1E)
      expect(result.matches[0].team2_id).toBe('team_f3');
      expect(result.matches[0].pendingSlots).toHaveLength(0);
    });
  });

  describe('leaves 3A/B/C/D/F pending if team_ids dont match standings', () => {
    it('should return pending with reason missing_third_place_assignment when qualified teams not found in standings', () => {
      const matches: Match[] = [
        {
          id: 'match-74',
          num: 74,
          round: 'round_of_32',
          date: '2026-06-29',
          time: '16:30 UTC-4',
          ground: 'Boston',
          team1_id: 'germany', // Set team1_id directly to avoid pending slot
          team2_slot: '3A/B/C/D/F',
        },
      ];

      const matchResults: MatchResult[] = [];
      const groupStandings = createMockGroupStandings();
      
      // Create bestThirds with qualified teams that don't exist in standings
      // This will cause bracket.ts to not be able to determine which groups they're from
      const bestThirds: BestThirdsOutput = {
        qualifiedThirds: [
          { team_id: 'team_e3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_f3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_g3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_h3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_i3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_j3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_k3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
          { team_id: 'team_l3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 1 },
        ],
        eliminatedThirds: [],
        orderedThirds: [],
        requiresManualTiebreak: false,
        pending: false,
        tiedInsideQualified: [],
        tiedInsideEliminated: [],
        tiedAtCut: [],
      };

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      // Team_ids don't match any teams in standings, so bracket can't determine groups
      expect(result.matches[0].team2_id).toBeUndefined();
      expect(result.matches[0].pendingSlots).toHaveLength(1);
      expect(result.matches[0].pendingSlots[0].reason).toBe('missing_third_place_assignment');
      expect(result.matches[0].pendingSlots[0].slot).toBe('3A/B/C/D/F');
    });
  });

  describe('resolves W74 from previous result', () => {
    it('should resolve W74 to winner of match 74', () => {
      const matches: Match[] = [
        {
          id: 'match-74',
          num: 74,
          round: 'round_of_32',
          date: '2026-06-29',
          time: '16:30 UTC-4',
          ground: 'Boston',
          team1_id: 'germany',
          team2_id: 'spain',
        },
        {
          id: 'match-89',
          num: 89,
          round: 'round_of_16',
          date: '2026-07-04',
          time: '17:00 UTC-4',
          ground: 'Philadelphia',
          team1_slot: 'W74',
          team2_id: 'france', // Set team2_id directly to avoid pending slot
        },
      ];

      const matchResults: MatchResult[] = [
        {
          match_id: 'match-74',
          team1_score: 2,
          team2_score: 1,
          winner_team_id: 'germany',
        },
      ];

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[1].team1_id).toBe('germany');
      expect(result.matches[1].pendingSlots).toHaveLength(0);
    });
  });

  describe('resolves L101 from previous result', () => {
    it('should resolve L101 to loser of match 101', () => {
      const matches: Match[] = [
        {
          id: 'match-101',
          num: 101,
          round: 'semi_final',
          date: '2026-07-14',
          time: '14:00 UTC-5',
          ground: 'Dallas',
          team1_id: 'argentina',
          team2_id: 'brazil',
        },
        {
          id: 'match-103',
          round: 'third_place',
          date: '2026-07-18',
          time: '17:00 UTC-4',
          ground: 'Miami',
          team1_slot: 'L101',
          team2_id: 'croatia', // Set team2_id directly to avoid pending slot
        },
      ];

      const matchResults: MatchResult[] = [
        {
          match_id: 'match-101',
          team1_score: 1,
          team2_score: 2,
          winner_team_id: 'brazil',
        },
      ];

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[1].team1_id).toBe('argentina');
      expect(result.matches[1].pendingSlots).toHaveLength(0);
    });
  });

  describe('leaves W74 pending if missing previous result', () => {
    it('should return pending with reason missing_match_result', () => {
      const matches: Match[] = [
        {
          id: 'match-74',
          num: 74,
          round: 'round_of_32',
          date: '2026-06-29',
          time: '16:30 UTC-4',
          ground: 'Boston',
          team1_id: 'germany',
          team2_id: 'spain',
        },
        {
          id: 'match-89',
          num: 89,
          round: 'round_of_16',
          date: '2026-07-04',
          time: '17:00 UTC-4',
          ground: 'Philadelphia',
          team1_slot: 'W74',
          team2_id: 'france', // Set team2_id directly to avoid pending slot
        },
      ];

      const matchResults: MatchResult[] = []; // No result for match 74

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[1].team1_id).toBeUndefined();
      expect(result.matches[1].pendingSlots).toHaveLength(1);
      expect(result.matches[1].pendingSlots[0].reason).toBe('missing_match_result');
      expect(result.matches[1].pendingSlots[0].slot).toBe('W74');
    });
  });

  describe('uses team1_id/team2_id if already exist', () => {
    it('should use existing team1_id instead of resolving slot', () => {
      const matches: Match[] = [
        {
          id: 'match-73',
          num: 73,
          round: 'round_of_32',
          date: '2026-06-28',
          time: '12:00 UTC-7',
          ground: 'Los Angeles',
          team1_id: 'france', // Already set, ignore slot
          team1_slot: '1A',
          team2_slot: '2B',
        },
      ];

      const matchResults: MatchResult[] = [];
      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[0].team1_id).toBe('france');
      expect(result.matches[0].team1_slot).toBeUndefined(); // Slot is cleared when team is set
      expect(result.matches[0].pendingSlots).toHaveLength(0);
    });

    it('should use existing team2_id instead of resolving slot', () => {
      const matches: Match[] = [
        {
          id: 'match-73',
          num: 73,
          round: 'round_of_32',
          date: '2026-06-28',
          time: '12:00 UTC-7',
          ground: 'Los Angeles',
          team1_slot: '1A',
          team2_id: 'brazil', // Already set, ignore slot
          team2_slot: '2B',
        },
      ];

      const matchResults: MatchResult[] = [];
      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[0].team2_id).toBe('brazil');
      expect(result.matches[0].team2_slot).toBeUndefined(); // Slot is cleared when team is set
      expect(result.matches[0].pendingSlots).toHaveLength(0);
    });
  });

  describe('preserves original slot if cannot resolve', () => {
    it('should keep original slot when resolution fails', () => {
      const matches: Match[] = [
        {
          id: 'match-73',
          num: 73,
          round: 'round_of_32',
          date: '2026-06-28',
          time: '12:00 UTC-7',
          ground: 'Los Angeles',
          team1_slot: '1C', // Group C not in standings
          team2_slot: '2B',
        },
      ];

      const matchResults: MatchResult[] = [];
      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[0].team1_id).toBeUndefined();
      expect(result.matches[0].team1_slot).toBe('1C'); // Original slot preserved
      expect(result.matches[0].pendingSlots).toHaveLength(1);
    });
  });

  describe('detects champion when final has winner_team_id', () => {
    it('should set champion when final match has winner', () => {
      const matches: Match[] = [
        {
          id: 'match-104',
          round: 'final',
          date: '2026-07-19',
          time: '15:00 UTC-4',
          ground: 'New York',
          team1_id: 'argentina',
          team2_id: 'france',
        },
      ];

      const matchResults: MatchResult[] = [
        {
          match_id: 'match-104',
          team1_score: 3,
          team2_score: 2,
          winner_team_id: 'argentina',
        },
      ];

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.champion).toBe('argentina');
    });

    it('should not set champion when final has no winner yet', () => {
      const matches: Match[] = [
        {
          id: 'match-104',
          round: 'final',
          date: '2026-07-19',
          time: '15:00 UTC-4',
          ground: 'New York',
          team1_id: 'argentina',
          team2_id: 'france',
        },
      ];

      const matchResults: MatchResult[] = []; // No result yet

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.champion).toBeUndefined();
    });
  });

  describe('detects third place when third place match has winner_team_id', () => {
    it('should set thirdPlace when third place match has winner', () => {
      const matches: Match[] = [
        {
          id: 'match-103',
          round: 'third_place',
          date: '2026-07-18',
          time: '17:00 UTC-4',
          ground: 'Miami',
          team1_id: 'croatia',
          team2_id: 'morocco',
        },
      ];

      const matchResults: MatchResult[] = [
        {
          match_id: 'match-103',
          team1_score: 2,
          team2_score: 1,
          winner_team_id: 'croatia',
        },
      ];

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.thirdPlace).toBe('croatia');
    });

    it('should not set thirdPlace when third place match has no winner yet', () => {
      const matches: Match[] = [
        {
          id: 'match-103',
          round: 'third_place',
          date: '2026-07-18',
          time: '17:00 UTC-4',
          ground: 'Miami',
          team1_id: 'croatia',
          team2_id: 'morocco',
        },
      ];

      const matchResults: MatchResult[] = []; // No result yet

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.thirdPlace).toBeUndefined();
    });
  });

  describe('complete flag', () => {
    it('should set complete to true when champion exists and no pending slots', () => {
      const matches: Match[] = [
        {
          id: 'match-104',
          round: 'final',
          date: '2026-07-19',
          time: '15:00 UTC-4',
          ground: 'New York',
          team1_id: 'argentina',
          team2_id: 'france',
        },
      ];

      const matchResults: MatchResult[] = [
        {
          match_id: 'match-104',
          team1_score: 3,
          team2_score: 2,
          winner_team_id: 'argentina',
        },
      ];

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.complete).toBe(true);
    });

    it('should set complete to false when champion does not exist', () => {
      const matches: Match[] = [
        {
          id: 'match-104',
          round: 'final',
          date: '2026-07-19',
          time: '15:00 UTC-4',
          ground: 'New York',
          team1_id: 'argentina',
          team2_id: 'france',
        },
      ];

      const matchResults: MatchResult[] = [];

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.complete).toBe(false);
    });

    it('should set complete to false when there are pending slots', () => {
      const matches: Match[] = [
        {
          id: 'match-73',
          num: 73,
          round: 'round_of_32',
          date: '2026-06-28',
          time: '12:00 UTC-7',
          ground: 'Los Angeles',
          team1_slot: '1C', // Group C not in standings, will be pending
          team2_slot: '2B',
        },
        {
          id: 'match-104',
          round: 'final',
          date: '2026-07-19',
          time: '15:00 UTC-4',
          ground: 'New York',
          team1_id: 'argentina',
          team2_id: 'france',
        },
      ];

      const matchResults: MatchResult[] = [
        {
          match_id: 'match-104',
          team1_score: 3,
          team2_score: 2,
          winner_team_id: 'argentina',
        },
      ];

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.champion).toBe('argentina');
      expect(result.complete).toBe(false); // Has pending slots
    });
  });

  describe('winner and loser tracking', () => {
    it('should infer winner from score when winner_team_id not set', () => {
      const matches: Match[] = [
        {
          id: 'match-74',
          num: 74,
          round: 'round_of_32',
          date: '2026-06-29',
          time: '16:30 UTC-4',
          ground: 'Boston',
          team1_id: 'germany',
          team2_id: 'spain',
        },
      ];

      const matchResults: MatchResult[] = [
        {
          match_id: 'match-74',
          team1_score: 2,
          team2_score: 1,
          // winner_team_id not set, should infer from score
        },
      ];

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[0].winner_team_id).toBe('germany');
      expect(result.matches[0].loser_team_id).toBe('spain');
    });

    it('should use explicit winner_team_id when set', () => {
      const matches: Match[] = [
        {
          id: 'match-74',
          num: 74,
          round: 'round_of_32',
          date: '2026-06-29',
          time: '16:30 UTC-4',
          ground: 'Boston',
          team1_id: 'germany',
          team2_id: 'spain',
        },
      ];

      const matchResults: MatchResult[] = [
        {
          match_id: 'match-74',
          team1_score: 1,
          team2_score: 1,
          winner_team_id: 'germany', // Germany advances despite draw
        },
      ];

      const groupStandings = createMockGroupStandings();
      const bestThirds = createMockBestThirds();

      const result = resolveBracket(matches, matchResults, groupStandings, bestThirds);

      expect(result.matches[0].winner_team_id).toBe('germany');
      expect(result.matches[0].loser_team_id).toBe('spain');
    });
  });
});
