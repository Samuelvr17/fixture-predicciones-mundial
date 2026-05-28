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
  ManualTiebreak,
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

  it('group tied without manual_tiebreak => requiresManualTiebreak true', () => {
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

    expect(output.requiresManualTiebreak).toBe(true);
    expect(output.standings['G'].requiresManualTiebreak).toBe(true);
    expect(output.standings['G'].tiedTeams).toContain('t1');
    expect(output.standings['G'].tiedTeams).toContain('t2');
  });

  it('group tied with manual_tiebreak => manual order applied only within tied block', () => {
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

    const manualTiebreaks: ManualTiebreak[] = [
      {
        type: 'group',
        reference: 'group_G',
        ordered_team_ids: ['t2', 't1'],
      },
    ];

    const output = calculateGroupStandings(teams, matches, results, manualTiebreaks);
    const standings = output.standings['G'].standings;

    expect(output.requiresManualTiebreak).toBe(false);
    expect(output.standings['G'].requiresManualTiebreak).toBe(false);
    expect(output.standings['G'].tiedTeams).toEqual([]);
    // t3 has 9 points and should remain first (manual tiebreak only affects tied block)
    expect(standings[0].team_id).toBe('t3');
    expect(standings[0].points).toBe(9);
    // t2 and t1 are tied (3 points each) and should be reordered by manual tiebreak
    expect(standings[1].team_id).toBe('t2');
    expect(standings[2].team_id).toBe('t1');
    expect(standings[3].team_id).toBe('t4');
  });

  it('manual_tiebreak partial maintains teams remaining in automatic order', () => {
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

    const manualTiebreaks: ManualTiebreak[] = [
      {
        type: 'group',
        reference: 'group_G',
        ordered_team_ids: ['t2', 't1'], // Specify order for both tied teams
      },
    ];

    const output = calculateGroupStandings(teams, matches, results, manualTiebreaks);
    const standings = output.standings['G'].standings;

    expect(output.requiresManualTiebreak).toBe(false);
    expect(output.standings['G'].requiresManualTiebreak).toBe(false);
    expect(output.standings['G'].tiedTeams).toEqual([]);
    // t3 has 9 points and should remain first
    expect(standings[0].team_id).toBe('t3');
    expect(standings[0].points).toBe(9);
    // t2 and t1 are tied (3 points each) and should be reordered by manual tiebreak
    expect(standings[1].team_id).toBe('t2');
    expect(standings[2].team_id).toBe('t1');
    expect(standings[3].team_id).toBe('t4');
  });

  it('manual_tiebreak for different group does not affect this group', () => {
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

    const manualTiebreaks: ManualTiebreak[] = [
      {
        type: 'group',
        reference: 'group_H', // Different group
        ordered_team_ids: ['t2', 't1'],
      },
    ];

    const output = calculateGroupStandings(teams, matches, results, manualTiebreaks);

    // Group G should still require manual tiebreak since the tiebreak is for group H
    expect(output.requiresManualTiebreak).toBe(true);
    expect(output.standings['G'].requiresManualTiebreak).toBe(true);
    expect(output.standings['G'].tiedTeams).toContain('t1');
    expect(output.standings['G'].tiedTeams).toContain('t2');
  });

  it('manual_tiebreak Grupo E real scenario - Germany 6pts, Ecuador/Curaçao 4pts tied', () => {
    const teams: Team[] = [
      { id: 'germany', name: 'Germany', code: 'GER', group_code: 'E' },
      { id: 'curacao', name: 'Curaçao', code: 'CUW', group_code: 'E' },
      { id: 'ecuador', name: 'Ecuador', code: 'ECU', group_code: 'E' },
      { id: 'ivory_coast', name: 'Ivory Coast', code: 'CIV', group_code: 'E' },
    ];

    const matches: Match[] = [
      { id: 'm1', team1_id: 'germany', team2_id: 'curacao', group_code: 'E', round: 'group' },
      { id: 'm2', team1_id: 'ecuador', team2_id: 'ivory_coast', group_code: 'E', round: 'group' },
      { id: 'm3', team1_id: 'germany', team2_id: 'ecuador', group_code: 'E', round: 'group' },
      { id: 'm4', team1_id: 'curacao', team2_id: 'ivory_coast', group_code: 'E', round: 'group' },
      { id: 'm5', team1_id: 'germany', team2_id: 'ivory_coast', group_code: 'E', round: 'group' },
      { id: 'm6', team1_id: 'curacao', team2_id: 'ecuador', group_code: 'E', round: 'group' },
    ];

    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 2, team2_score: 0 }, // Germany wins
      { match_id: 'm2', team1_score: 2, team2_score: 0 }, // Ecuador wins
      { match_id: 'm3', team1_score: 2, team2_score: 0 }, // Germany wins
      { match_id: 'm4', team1_score: 2, team2_score: 0 }, // Curaçao wins
      { match_id: 'm5', team1_score: 0, team2_score: 1 }, // Ivory Coast wins
      { match_id: 'm6', team1_score: 1, team2_score: 1 }, // Draw
    ];

    // Without manual tiebreak: Germany(6), Curaçao(4), Ecuador(4), Ivory Coast(3)
    const outputWithoutManual = calculateGroupStandings(teams, matches, results);
    expect(outputWithoutManual.standings['E'].standings[0].team_id).toBe('germany');
    expect(outputWithoutManual.standings['E'].standings[0].points).toBe(6);
    expect(outputWithoutManual.standings['E'].standings[1].points).toBe(4);
    expect(outputWithoutManual.standings['E'].standings[2].points).toBe(4);
    expect(outputWithoutManual.standings['E'].standings[3].points).toBe(3);
    expect(outputWithoutManual.requiresManualTiebreak).toBe(true);

    // With manual tiebreak: Ecuador should be 2nd, Curaçao 3rd
    const manualTiebreaks: ManualTiebreak[] = [
      {
        type: 'group',
        reference: 'group_E',
        ordered_team_ids: ['ecuador', 'curacao'],
      },
    ];

    const output = calculateGroupStandings(teams, matches, results, manualTiebreaks);
    const standings = output.standings['E'].standings;

    expect(output.requiresManualTiebreak).toBe(false);
    // Germany must remain first (6pts > 4pts)
    expect(standings[0].team_id).toBe('germany');
    expect(standings[0].points).toBe(6);
    // Ecuador should be 2nd (manual order within tied block)
    expect(standings[1].team_id).toBe('ecuador');
    expect(standings[1].points).toBe(4);
    // Curaçao should be 3rd (manual order within tied block)
    expect(standings[2].team_id).toBe('curacao');
    expect(standings[2].points).toBe(4);
    // Ivory Coast should remain 4th (3pts < 4pts)
    expect(standings[3].team_id).toBe('ivory_coast');
    expect(standings[3].points).toBe(3);
  });

  it('manual_tiebreak reverse order - Curaçao above Ecuador', () => {
    const teams: Team[] = [
      { id: 'germany', name: 'Germany', code: 'GER', group_code: 'E' },
      { id: 'curacao', name: 'Curaçao', code: 'CUW', group_code: 'E' },
      { id: 'ecuador', name: 'Ecuador', code: 'ECU', group_code: 'E' },
      { id: 'ivory_coast', name: 'Ivory Coast', code: 'CIV', group_code: 'E' },
    ];

    const matches: Match[] = [
      { id: 'm1', team1_id: 'germany', team2_id: 'curacao', group_code: 'E', round: 'group' },
      { id: 'm2', team1_id: 'ecuador', team2_id: 'ivory_coast', group_code: 'E', round: 'group' },
      { id: 'm3', team1_id: 'germany', team2_id: 'ecuador', group_code: 'E', round: 'group' },
      { id: 'm4', team1_id: 'curacao', team2_id: 'ivory_coast', group_code: 'E', round: 'group' },
      { id: 'm5', team1_id: 'germany', team2_id: 'ivory_coast', group_code: 'E', round: 'group' },
      { id: 'm6', team1_id: 'curacao', team2_id: 'ecuador', group_code: 'E', round: 'group' },
    ];

    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 2, team2_score: 0 },
      { match_id: 'm2', team1_score: 2, team2_score: 0 },
      { match_id: 'm3', team1_score: 2, team2_score: 0 },
      { match_id: 'm4', team1_score: 2, team2_score: 0 },
      { match_id: 'm5', team1_score: 0, team2_score: 1 },
      { match_id: 'm6', team1_score: 1, team2_score: 1 },
    ];

    const manualTiebreaks: ManualTiebreak[] = [
      {
        type: 'group',
        reference: 'group_E',
        ordered_team_ids: ['curacao', 'ecuador'],
      },
    ];

    const output = calculateGroupStandings(teams, matches, results, manualTiebreaks);
    const standings = output.standings['E'].standings;

    expect(output.requiresManualTiebreak).toBe(false);
    expect(standings[0].team_id).toBe('germany');
    expect(standings[0].points).toBe(6);
    // Curaçao should be 2nd (reverse manual order)
    expect(standings[1].team_id).toBe('curacao');
    expect(standings[1].points).toBe(4);
    // Ecuador should be 3rd (reverse manual order)
    expect(standings[2].team_id).toBe('ecuador');
    expect(standings[2].points).toBe(4);
    expect(standings[3].team_id).toBe('ivory_coast');
    expect(standings[3].points).toBe(3);
  });

  it('manual_tiebreak protects teams outside tied block', () => {
    const teams: Team[] = [
      { id: 'germany', name: 'Germany', code: 'GER', group_code: 'E' },
      { id: 'curacao', name: 'Curaçao', code: 'CUW', group_code: 'E' },
      { id: 'ecuador', name: 'Ecuador', code: 'ECU', group_code: 'E' },
      { id: 'ivory_coast', name: 'Ivory Coast', code: 'CIV', group_code: 'E' },
    ];

    const matches: Match[] = [
      { id: 'm1', team1_id: 'germany', team2_id: 'curacao', group_code: 'E', round: 'group' },
      { id: 'm2', team1_id: 'ecuador', team2_id: 'ivory_coast', group_code: 'E', round: 'group' },
      { id: 'm3', team1_id: 'germany', team2_id: 'ecuador', group_code: 'E', round: 'group' },
      { id: 'm4', team1_id: 'curacao', team2_id: 'ivory_coast', group_code: 'E', round: 'group' },
      { id: 'm5', team1_id: 'germany', team2_id: 'ivory_coast', group_code: 'E', round: 'group' },
      { id: 'm6', team1_id: 'curacao', team2_id: 'ecuador', group_code: 'E', round: 'group' },
    ];

    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 2, team2_score: 0 },
      { match_id: 'm2', team1_score: 2, team2_score: 0 },
      { match_id: 'm3', team1_score: 2, team2_score: 0 },
      { match_id: 'm4', team1_score: 2, team2_score: 0 },
      { match_id: 'm5', team1_score: 0, team2_score: 1 },
      { match_id: 'm6', team1_score: 1, team2_score: 1 },
    ];

    const manualTiebreaks: ManualTiebreak[] = [
      {
        type: 'group',
        reference: 'group_E',
        ordered_team_ids: ['ecuador', 'curacao'],
      },
    ];

    const output = calculateGroupStandings(teams, matches, results, manualTiebreaks);
    const standings = output.standings['E'].standings;

    // Germany must remain 1st (6pts)
    expect(standings[0].team_id).toBe('germany');
    expect(standings[0].points).toBe(6);
    // Ivory Coast must remain 4th (3pts)
    expect(standings[3].team_id).toBe('ivory_coast');
    expect(standings[3].points).toBe(3);
  });

  it('manual_tiebreak does not mix teams between multiple tied blocks', () => {
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

    // Create scenario with two tied blocks:
    // Block 1 (positions 1-2): t1 and t2 tied at 4 points
    // Block 2 (positions 3-4): t3 and t4 tied at 4 points (but different goal difference so they're separate)
    const results: MatchResult[] = [
      { match_id: 'm1', team1_score: 1, team2_score: 1 }, // t1 vs t2 draw
      { match_id: 'm2', team1_score: 1, team2_score: 1 }, // t3 vs t4 draw
      { match_id: 'm3', team1_score: 2, team2_score: 0 }, // t1 wins vs t3
      { match_id: 'm4', team1_score: 2, team2_score: 0 }, // t2 wins vs t4
      { match_id: 'm5', team1_score: 0, team2_score: 1 }, // t1 loses vs t4
      { match_id: 'm6', team1_score: 0, team2_score: 1 }, // t2 loses vs t3
    ];

    // Manual tiebreak only for the first block (t1, t2)
    const manualTiebreaks: ManualTiebreak[] = [
      {
        type: 'group',
        reference: 'group_G',
        ordered_team_ids: ['t2', 't1'],
      },
    ];

    const output = calculateGroupStandings(teams, matches, results, manualTiebreaks);
    const standings = output.standings['G'].standings;

    expect(output.requiresManualTiebreak).toBe(true); // t3 and t4 still tied
    // First block (t1, t2) should be reordered by manual tiebreak
    expect(standings[0].team_id).toBe('t2');
    expect(standings[0].points).toBe(4);
    expect(standings[1].team_id).toBe('t1');
    expect(standings[1].points).toBe(4);
    // Second block (t3, t4) should remain in automatic order (still tied)
    expect(standings[2].points).toBe(4);
    expect(standings[3].points).toBe(4);
    // Verify t3 and t4 are still tied
    expect(output.standings['G'].tiedTeams).toContain('t3');
    expect(output.standings['G'].tiedTeams).toContain('t4');
  });
});
