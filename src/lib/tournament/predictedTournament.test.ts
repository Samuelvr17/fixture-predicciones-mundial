import { describe, expect, it } from 'vitest';
import { buildPredictedTournamentFromScores, type PredictedTournamentMatch, type PredictedTournamentTeam } from './predictedTournament';

const teams: PredictedTournamentTeam[] = [
  { id: 'a', name: 'Team A', code: 'A', group_code: 'A' },
  { id: 'b', name: 'Team B', code: 'B', group_code: 'A' },
  { id: 'c', name: 'Team C', code: 'C', group_code: 'A' },
  { id: 'd', name: 'Team D', code: 'D', group_code: 'A' },
];

const matches: PredictedTournamentMatch[] = [
  { id: 'm1', match_number: 1, round: 'group', group_code: 'A', match_date: '2026-06-01', match_time: '12:00', venue: 'Stadium', team1_id: 'a', team2_id: 'b', team1_slot: null, team2_slot: null },
  { id: 'm2', match_number: 2, round: 'group', group_code: 'A', match_date: '2026-06-01', match_time: '15:00', venue: 'Stadium', team1_id: 'c', team2_id: 'd', team1_slot: null, team2_slot: null },
  { id: 'm3', match_number: 3, round: 'group', group_code: 'A', match_date: '2026-06-02', match_time: '12:00', venue: 'Stadium', team1_id: 'a', team2_id: 'c', team1_slot: null, team2_slot: null },
  { id: 'm4', match_number: 4, round: 'group', group_code: 'A', match_date: '2026-06-02', match_time: '15:00', venue: 'Stadium', team1_id: 'b', team2_id: 'd', team1_slot: null, team2_slot: null },
  { id: 'm5', match_number: 5, round: 'group', group_code: 'A', match_date: '2026-06-03', match_time: '12:00', venue: 'Stadium', team1_id: 'a', team2_id: 'd', team1_slot: null, team2_slot: null },
  { id: 'm6', match_number: 6, round: 'group', group_code: 'A', match_date: '2026-06-03', match_time: '15:00', venue: 'Stadium', team1_id: 'b', team2_id: 'c', team1_slot: null, team2_slot: null },
  { id: 'r32', match_number: 73, round: 'round_of_32', group_code: null, match_date: '2026-06-10', match_time: '12:00', venue: 'Stadium', team1_id: null, team2_id: null, team1_slot: '1A', team2_slot: '2A' },
];

const scorelessDrawPredictions = matches
  .filter((match) => match.round === 'group')
  .map((match) => ({
    match_id: match.id,
    predicted_team1_score: 0,
    predicted_team2_score: 0,
    predicted_winner_team_id: null,
  }));

describe('buildPredictedTournamentFromScores manual tiebreaks', () => {
  it('passes user manual group tiebreaks into standings and changes predicted bracket slots', () => {
    const automatic = buildPredictedTournamentFromScores(teams, matches, scorelessDrawPredictions);

    expect(automatic.groupStandings.standings.A.requiresManualTiebreak).toBe(true);
    expect(automatic.bracket.matches[0].team1_id).toBe('a');
    expect(automatic.bracket.matches[0].team2_id).toBe('b');

    const withManualOrder = buildPredictedTournamentFromScores(
      teams,
      matches,
      scorelessDrawPredictions,
      [{ type: 'group', reference: 'group_A', ordered_team_ids: ['b', 'a', 'c', 'd'] }]
    );

    expect(withManualOrder.groupStandings.standings.A.requiresManualTiebreak).toBe(false);
    expect(withManualOrder.groupStandings.standings.A.standings.map((team) => team.team_id)).toEqual([
      'b',
      'a',
      'c',
      'd',
    ]);
    expect(withManualOrder.bracket.matches[0].team1_id).toBe('b');
    expect(withManualOrder.bracket.matches[0].team2_id).toBe('a');
  });
});
