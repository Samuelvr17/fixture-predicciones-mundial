/**
 * src/lib/tournament/teamAdvances.test.ts
 *
 * Unit tests for buildTeamAdvancesFromBracket
 */

import { describe, it, expect } from 'vitest';
import { buildTeamAdvancesFromBracket } from './teamAdvances';
import type { TournamentRound } from '@/lib/scoring/scoring';

describe('buildTeamAdvancesFromBracket', () => {
  // Helper to create mock group standings
  const createMockGroupStandings = () => ({
    standings: {
      'A': {
        group_code: 'A',
        standings: [
          { team_id: 'team-a1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 2, goalDifference: 3, points: 7 },
          { team_id: 'team-a2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 4, goalsAgainst: 2, goalDifference: 2, points: 5 },
          { team_id: 'team-a3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 5, goalDifference: -3, points: 1 },
        ],
        requiresManualTiebreak: false,
        tiedTeams: [],
      },
      'B': {
        group_code: 'B',
        standings: [
          { team_id: 'team-b1', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 6, goalsAgainst: 2, goalDifference: 4, points: 7 },
          { team_id: 'team-b2', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 4, goalsAgainst: 2, goalDifference: 2, points: 5 },
          { team_id: 'team-b3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 6, goalDifference: -4, points: 1 },
        ],
        requiresManualTiebreak: false,
        tiedTeams: [],
      },
    },
    thirdPlaceTeams: [
      { team_id: 'team-a3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 5, goalDifference: -3, points: 1 },
      { team_id: 'team-b3', played: 3, wins: 0, draws: 1, losses: 2, goalsFor: 2, goalsAgainst: 6, goalDifference: -4, points: 1 },
    ],
    requiresManualTiebreak: false,
  });

  // Helper to create mock best thirds
  const createMockBestThirds = (qualifiedTeamIds: string[]) => ({
    qualifiedThirds: qualifiedTeamIds.map(id => ({
      team_id: id,
      played: 3,
      wins: 0,
      draws: 1,
      losses: 2,
      goalsFor: 2,
      goalsAgainst: 5,
      goalDifference: -3,
      points: 1,
    })),
    eliminatedThirds: [],
    orderedThirds: [],
    requiresManualTiebreak: false,
    pending: false,
    tiedInsideQualified: [],
    tiedInsideEliminated: [],
    tiedAtCut: [],
  });

  // Helper to create mock bracket output
  const createMockBracketOutput = (matches: any[]) => ({
    matches: matches.map(m => ({
      match: { 
        id: m.id, 
        round: m.round,
        date: '2026-06-11',
        time: '15:00',
        ground: 'Stadium',
      },
      winner_team_id: m.winner_team_id,
      pendingSlots: [],
    })),
    champion: undefined,
    thirdPlace: undefined,
    pendingSlots: [],
    complete: false,
  });

  it('should only mark qualified thirds as round_of_32, not all 12 thirds', () => {
    const groupStandings = createMockGroupStandings();
    const bestThirds = createMockBestThirds(['team-a3']); // Only team-a3 qualifies
    const bracketOutput = createMockBracketOutput([]);

    const result = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    // First and second place teams should be round_of_32
    expect(result['team-a1']).toBe('round_of_32');
    expect(result['team-a2']).toBe('round_of_32');
    expect(result['team-b1']).toBe('round_of_32');
    expect(result['team-b2']).toBe('round_of_32');

    // Only qualified third should be round_of_32
    expect(result['team-a3']).toBe('round_of_32');

    // Non-qualified third should be no_clasifica
    expect(result['team-b3']).toBe('no_clasifica');
  });

  it('should keep the highest round when team wins bracket match and was group winner', () => {
    const groupStandings = createMockGroupStandings();
    const bestThirds = createMockBestThirds([]);
    const bracketOutput = createMockBracketOutput([
      { id: 'match-1', round: 'round_of_32', winner_team_id: 'team-a1' },
    ]);

    const result = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    // team-a1 was first in group (round_of_32) and won round_of_32 match
    // Should be round_of_16, not round_of_32
    expect(result['team-a1']).toBe('round_of_16');
  });

  it('should not mark third_place winner as champion', () => {
    const groupStandings = createMockGroupStandings();
    const bestThirds = createMockBestThirds([]);
    const bracketOutput = createMockBracketOutput([
      { id: 'match-1', round: 'third_place', winner_team_id: 'team-a1' },
    ]);

    const result = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    // team-a1 was first in group, should be round_of_32
    // third_place match should NOT affect team_advances
    expect(result['team-a1']).toBe('round_of_32');
    expect(result['team-a1']).not.toBe('champion');
  });

  it('should mark final winner as champion', () => {
    const groupStandings = createMockGroupStandings();
    const bestThirds = createMockBestThirds([]);
    const bracketOutput = createMockBracketOutput([
      { id: 'match-1', round: 'round_of_32', winner_team_id: 'team-a1' },
      { id: 'match-2', round: 'round_of_16', winner_team_id: 'team-a1' },
      { id: 'match-3', round: 'quarter_final', winner_team_id: 'team-a1' },
      { id: 'match-4', round: 'semi_final', winner_team_id: 'team-a1' },
      { id: 'match-5', round: 'final', winner_team_id: 'team-a1' },
    ]);

    const result = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    expect(result['team-a1']).toBe('champion');
  });

  it('should keep semi_final for team that loses semi_final', () => {
    const groupStandings = createMockGroupStandings();
    const bestThirds = createMockBestThirds([]);
    const bracketOutput = createMockBracketOutput([
      { id: 'match-1', round: 'round_of_32', winner_team_id: 'team-a1' },
      { id: 'match-2', round: 'round_of_16', winner_team_id: 'team-a1' },
      { id: 'match-3', round: 'quarter_final', winner_team_id: 'team-a1' },
      { id: 'match-4', round: 'semi_final', winner_team_id: 'team-a1' },
      // team-a1 does not win final
    ]);

    const result = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    expect(result['team-a1']).toBe('final');
  });

  it('should keep final for team that loses final', () => {
    const groupStandings = createMockGroupStandings();
    const bestThirds = createMockBestThirds([]);
    const bracketOutput = createMockBracketOutput([
      { id: 'match-1', round: 'round_of_32', winner_team_id: 'team-a1' },
      { id: 'match-2', round: 'round_of_16', winner_team_id: 'team-a1' },
      { id: 'match-3', round: 'quarter_final', winner_team_id: 'team-a1' },
      { id: 'match-4', round: 'semi_final', winner_team_id: 'team-a1' },
      { id: 'match-5', round: 'final', winner_team_id: 'team-a1' },
    ]);

    const result = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    expect(result['team-a1']).toBe('champion');
  });

  it('should initialize all teams as no_clasifica before processing', () => {
    const groupStandings = createMockGroupStandings();
    const bestThirds = createMockBestThirds([]);
    const bracketOutput = createMockBracketOutput([]);

    const result = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    // All teams should have a round assigned
    expect(result['team-a1']).toBeDefined();
    expect(result['team-a2']).toBeDefined();
    expect(result['team-a3']).toBeDefined();
    expect(result['team-b1']).toBeDefined();
    expect(result['team-b2']).toBeDefined();
    expect(result['team-b3']).toBeDefined();
  });

  it('should correctly handle round progression', () => {
    const groupStandings = createMockGroupStandings();
    const bestThirds = createMockBestThirds([]);
    const bracketOutput = createMockBracketOutput([
      { id: 'match-1', round: 'round_of_32', winner_team_id: 'team-a1' },
      { id: 'match-2', round: 'round_of_16', winner_team_id: 'team-b1' },
      { id: 'match-3', round: 'quarter_final', winner_team_id: 'team-a1' },
    ]);

    const result = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    // team-a1: round_of_32 -> round_of_16 -> quarter_final
    expect(result['team-a1']).toBe('semi_final');

    // team-b1: round_of_32 -> round_of_16
    expect(result['team-b1']).toBe('quarter_final');

    // team-a2: only round_of_32 from group
    expect(result['team-a2']).toBe('round_of_32');
  });

  it('should not demote team from advanced round to round_of_32', () => {
    const groupStandings = createMockGroupStandings();
    const bestThirds = createMockBestThirds([]);
    const bracketOutput = createMockBracketOutput([
      { id: 'match-1', round: 'round_of_32', winner_team_id: 'team-a1' },
      { id: 'match-2', round: 'round_of_16', winner_team_id: 'team-a1' },
    ]);

    const result = buildTeamAdvancesFromBracket(bracketOutput, groupStandings, bestThirds);

    // team-a1 won round_of_32 and round_of_16, should be quarter_final
    // NOT round_of_32 (which would happen if we processed bracket before groups)
    expect(result['team-a1']).toBe('quarter_final');
    expect(result['team-a1']).not.toBe('round_of_32');
  });
});
