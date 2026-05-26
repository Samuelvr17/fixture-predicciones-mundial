/**
 * Unit tests for group standings engine
 * Pure TypeScript tests without external dependencies
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGroupStandings,
  Team,
  Match,
  MatchResult,
} from './groupStandings';

describe('groupStandings', () => {
  it('simple group without ties', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Team A', code: 'A', group_code: 'G' },
      { id: 't2', name: 'Team B', code: 'B', group_code: 'G' },
      { id: 't3', name: 'Team C', code: 'C', group_code: 'G' },
      { id: 't4', name: 'Team D', code: 'D', group_code: 'G' },
    ];

    const matches: Match[] = [
      { id: 'm1', team1_id: 't1', team2_id: 't2', group_code: 'G', round: 'group' },
      { id: 'm2', team1_id: 't3', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm3', team1_id: 't1', team2_id: 't3', group_code: 'G', round: 'group' },
      { id: 'm4', team1_id: 't2', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm5', team1_id: 't1', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm6', team1_id: 't2', team2_id: 't3', group_code: 'G', round: 'group' },
    ];

    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 3, team2_score: 0 },
      { match_id: 'm2', team1_score: 2, team2_score: 1 },
      { match_id: 'm3', team1_score: 2, team2_score: 0 },
      { match_id: 'm4', team1_score: 2, team2_score: 0 },
      { match_id: 'm5', team1_score: 3, team2_score: 0 },
      { match_id: 'm6', team1_score: 0, team2_score: 2 },
    ];

    const output = calculateGroupStandings(teams, matches, results);
    const standings = output.standings['G'].standings;

    expect(standings[0].team_id).toBe('t1');
    expect(standings[0].points).toBe(9);
    expect(standings[1].team_id).toBe('t3');
    expect(standings[1].points).toBe(6);
    expect(standings[2].team_id).toBe('t2');
    expect(standings[2].points).toBe(3);
    expect(standings[3].team_id).toBe('t4');
    expect(standings[3].points).toBe(0);
    expect(output.requiresManualTiebreak).toBe(false);
  });

  it('tie resolved by head-to-head points', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Team A', code: 'A', group_code: 'G' },
      { id: 't2', name: 'Team B', code: 'B', group_code: 'G' },
      { id: 't3', name: 'Team C', code: 'C', group_code: 'G' },
      { id: 't4', name: 'Team D', code: 'D', group_code: 'G' },
    ];

    const matches: Match[] = [
      { id: 'm1', team1_id: 't1', team2_id: 't2', group_code: 'G', round: 'group' },
      { id: 'm2', team1_id: 't3', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm3', team1_id: 't1', team2_id: 't3', group_code: 'G', round: 'group' },
      { id: 'm4', team1_id: 't2', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm5', team1_id: 't1', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm6', team1_id: 't2', team2_id: 't3', group_code: 'G', round: 'group' },
    ];

    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 2, team2_score: 1 },
      { match_id: 'm2', team1_score: 3, team2_score: 0 },
      { match_id: 'm3', team1_score: 0, team2_score: 2 },
      { match_id: 'm4', team1_score: 2, team2_score: 0 },
      { match_id: 'm5', team1_score: 3, team2_score: 0 },
      { match_id: 'm6', team1_score: 1, team2_score: 2 },
    ];

    const output = calculateGroupStandings(teams, matches, results);
    const standings = output.standings['G'].standings;

    expect(standings[0].team_id).toBe('t3');
    expect(standings[0].points).toBe(9);
    expect(standings[1].team_id).toBe('t1');
    expect(standings[1].points).toBe(6);
    expect(output.requiresManualTiebreak).toBe(false);
  });

  it('requires manual tiebreak when all criteria are identical', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Team A', code: 'A', group_code: 'G' },
      { id: 't2', name: 'Team B', code: 'B', group_code: 'G' },
      { id: 't3', name: 'Team C', code: 'C', group_code: 'G' },
      { id: 't4', name: 'Team D', code: 'D', group_code: 'G' },
    ];

    const matches: Match[] = [
      { id: 'm1', team1_id: 't1', team2_id: 't2', group_code: 'G', round: 'group' },
      { id: 'm2', team1_id: 't3', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm3', team1_id: 't1', team2_id: 't3', group_code: 'G', round: 'group' },
      { id: 'm4', team1_id: 't2', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm5', team1_id: 't1', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm6', team1_id: 't2', team2_id: 't3', group_code: 'G', round: 'group' },
    ];

    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 2, team2_score: 2 },
      { match_id: 'm2', team1_score: 1, team2_score: 0 },
      { match_id: 'm3', team1_score: 0, team2_score: 1 },
      { match_id: 'm4', team1_score: 2, team2_score: 0 },
      { match_id: 'm5', team1_score: 2, team2_score: 0 },
      { match_id: 'm6', team1_score: 0, team2_score: 1 },
    ];

    const output = calculateGroupStandings(teams, matches, results);
    const standings = output.standings['G'].standings;

    expect(standings[0].team_id).toBe('t3');
    expect(standings[0].points).toBe(9);
    expect(output.requiresManualTiebreak).toBe(true);
    expect(output.standings['G'].tiedTeams).toContain('t1');
    expect(output.standings['G'].tiedTeams).toContain('t2');
  });

  it('partially played group', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Team A', code: 'A', group_code: 'G' },
      { id: 't2', name: 'Team B', code: 'B', group_code: 'G' },
      { id: 't3', name: 'Team C', code: 'C', group_code: 'G' },
      { id: 't4', name: 'Team D', code: 'D', group_code: 'G' },
    ];

    const matches: Match[] = [
      { id: 'm1', team1_id: 't1', team2_id: 't2', group_code: 'G', round: 'group' },
      { id: 'm2', team1_id: 't3', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm3', team1_id: 't1', team2_id: 't3', group_code: 'G', round: 'group' },
      { id: 'm4', team1_id: 't2', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm5', team1_id: 't1', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm6', team1_id: 't2', team2_id: 't3', group_code: 'G', round: 'group' },
    ];

    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 2, team2_score: 1 },
      { match_id: 'm2', team1_score: 1, team2_score: 0 },
    ];

    const output = calculateGroupStandings(teams, matches, results);
    const standings = output.standings['G'].standings;

    expect(standings[0].points).toBe(3);
    expect(standings[0].played).toBe(1);
    expect(standings[1].points).toBe(3);
    expect(standings[1].played).toBe(1);
    expect(output.requiresManualTiebreak).toBe(false);
  });

  it('triple tie resolved by head-to-head points', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Team A', code: 'A', group_code: 'G' },
      { id: 't2', name: 'Team B', code: 'B', group_code: 'G' },
      { id: 't3', name: 'Team C', code: 'C', group_code: 'G' },
      { id: 't4', name: 'Team D', code: 'D', group_code: 'G' },
    ];

    const matches: Match[] = [
      { id: 'm1', team1_id: 't1', team2_id: 't2', group_code: 'G', round: 'group' },
      { id: 'm2', team1_id: 't3', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm3', team1_id: 't1', team2_id: 't3', group_code: 'G', round: 'group' },
      { id: 'm4', team1_id: 't2', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm5', team1_id: 't1', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm6', team1_id: 't2', team2_id: 't3', group_code: 'G', round: 'group' },
    ];

    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 2, team2_score: 1 },
      { match_id: 'm2', team1_score: 3, team2_score: 0 },
      { match_id: 'm3', team1_score: 1, team2_score: 2 },
      { match_id: 'm4', team1_score: 1, team2_score: 2 },
      { match_id: 'm5', team1_score: 2, team2_score: 0 },
      { match_id: 'm6', team1_score: 2, team2_score: 1 },
    ];

    const output = calculateGroupStandings(teams, matches, results);
    const standings = output.standings['G'].standings;

    expect(standings[0].team_id).toBe('t3');
    expect(standings[0].points).toBe(6);
    expect(standings[1].team_id).toBe('t1');
    expect(standings[1].points).toBe(6);
    expect(standings[2].team_id).toBe('t4');
    expect(standings[2].points).toBe(3);
    expect(standings[3].team_id).toBe('t2');
    expect(standings[3].points).toBe(3);
    expect(output.requiresManualTiebreak).toBe(false);
  });

  it('partial tie where positions 2-3 require manual tiebreak', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Team A', code: 'A', group_code: 'G' },
      { id: 't2', name: 'Team B', code: 'B', group_code: 'G' },
      { id: 't3', name: 'Team C', code: 'C', group_code: 'G' },
      { id: 't4', name: 'Team D', code: 'D', group_code: 'G' },
    ];

    const matches: Match[] = [
      { id: 'm1', team1_id: 't1', team2_id: 't2', group_code: 'G', round: 'group' },
      { id: 'm2', team1_id: 't3', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm3', team1_id: 't1', team2_id: 't3', group_code: 'G', round: 'group' },
      { id: 'm4', team1_id: 't2', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm5', team1_id: 't1', team2_id: 't4', group_code: 'G', round: 'group' },
      { id: 'm6', team1_id: 't2', team2_id: 't3', group_code: 'G', round: 'group' },
    ];

    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 3, team2_score: 0 },
      { match_id: 'm2', team1_score: 2, team2_score: 2 },
      { match_id: 'm3', team1_score: 3, team2_score: 0 },
      { match_id: 'm4', team1_score: 2, team2_score: 2 },
      { match_id: 'm5', team1_score: 3, team2_score: 0 },
      { match_id: 'm6', team1_score: 2, team2_score: 2 },
    ];

    const output = calculateGroupStandings(teams, matches, results);
    const standings = output.standings['G'].standings;

    expect(standings[0].team_id).toBe('t1');
    expect(standings[0].points).toBe(9);
    expect(output.requiresManualTiebreak).toBe(true);
    expect(output.standings['G'].tiedTeams).toContain('t2');
    expect(output.standings['G'].tiedTeams).toContain('t3');
    expect(output.standings['G'].tiedTeams).toContain('t4');
  });
});
