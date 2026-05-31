/**
 * src/lib/tournament/officialBracket.ts
 *
 * SERVER-SIDE ONLY helper – do NOT import from Client Components.
 *
 * Centralises all data fetching + engine calls needed to resolve the official
 * bracket.  Shared between:
 *   - /groups/[groupId]/bracket
 *   - /global-admin/results
 *
 * Returns:
 *   resolvedMatches  – knockout matches with team1_id/team2_id resolved from slots
 *   teams            – flat list of all teams
 *   groupStandings   – GroupStandingsOutput
 *   bestThirds       – BestThirdsOutput
 *   rawMatches       – all matches (group + knockout) straight from the DB
 *   rawResults       – all match_results straight from the DB
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
    calculateGroupStandings,
    Team,
    Match as GroupMatch,
    MatchResult as GroupMatchResult,
} from './groupStandings';
import { calculateBestThirds } from './bestThirds';
import {
    normalizeManualTiebreaksFromDb,
    separateTiebreaksByType,
    type DbManualTiebreak,
} from './manualTiebreaks';
import {
    resolveBracket,
    type Match,
    type MatchResult,
    type ManualTiebreak,
    type ResolvedMatch,
    type GroupStandingsOutput,
    type BestThirdsOutput,
} from './bracket';

// ============================================================================
// EXPORTED TYPES
// ============================================================================

export type { ResolvedMatch, GroupStandingsOutput, BestThirdsOutput };

export interface DbMatch {
    id: string;
    match_number: number | null;
    round: string;
    group_code: string | null;
    team1_id: string | null;
    team2_id: string | null;
    team1_slot: string | null;
    team2_slot: string | null;
    match_date: string;
    match_time: string;
    venue: string;
    sort_order: number;
}

export interface DbMatchResult {
    id: string;
    match_id: string;
    team1_score: number;
    team2_score: number;
    winner_team_id: string | null;
}

export interface DbTeam {
    id: string;
    name: string;
    display_name_es: string | null;
    code: string;
    group_code: string | null;
}

export interface OfficialBracketData {
    /** Knockout matches with team1_id/team2_id resolved from slot logic */
    resolvedMatches: ResolvedMatch[];
    /** Quick lookup: match_id → ResolvedMatch */
    resolvedMatchMap: Map<string, ResolvedMatch>;
    /** All teams */
    teams: DbTeam[];
    /** team_id → DbTeam */
    teamsMap: Map<string, DbTeam>;
    /** Full standings engine output */
    groupStandings: GroupStandingsOutput;
    /** Best thirds engine output */
    bestThirds: BestThirdsOutput;
    /** All DB matches (group + knockout) */
    rawMatches: DbMatch[];
    /** All DB match_results */
    rawResults: DbMatchResult[];
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Fetch all tournament data and run the bracket-resolution engine.
 *
 * @param supabase - An authenticated Supabase server client
 * @returns Resolved bracket data, or throws on DB error
 */
export async function fetchOfficialBracketData(
    supabase: SupabaseClient
): Promise<OfficialBracketData> {
    // Parallel fetch – order doesn't matter
    const [
        { data: teamsData, error: teamsError },
        { data: allMatchesData, error: matchesError },
        { data: allResultsData, error: resultsError },
        { data: manualTiebreaksData, error: tiebreaksError },
    ] = await Promise.all([
        supabase.from('teams').select('id, name, display_name_es, code, group_code'),
        supabase
            .from('matches')
            .select(
                'id, match_number, round, group_code, team1_id, team2_id, team1_slot, team2_slot, match_date, match_time, venue, sort_order'
            )
            .order('match_date', { ascending: true })
            .order('match_time', { ascending: true })
            .order('sort_order', { ascending: true }),
        supabase
            .from('match_results')
            .select('id, match_id, team1_score, team2_score, winner_team_id'),
        supabase.from('manual_tiebreaks').select('*'),
    ]);

    if (teamsError) throw new Error(`Error fetching teams: ${teamsError.message}`);
    if (matchesError) throw new Error(`Error fetching matches: ${matchesError.message}`);
    if (resultsError) throw new Error(`Error fetching match_results: ${resultsError.message}`);
    // Tiebreaks are optional; don't throw if missing

    const teams: DbTeam[] = teamsData || [];
    const rawMatches: DbMatch[] = allMatchesData || [];
    const rawResults: DbMatchResult[] = allResultsData || [];

    // ------------------------------------------------------------------
    // Build engine inputs
    // ------------------------------------------------------------------

    const teamsMap = new Map<string, DbTeam>(teams.map((t) => [t.id, t]));

    // Normalize manual tiebreaks
    const normalizedTiebreaks = normalizeManualTiebreaksFromDb(
        (manualTiebreaksData || []) as DbManualTiebreak[]
    );
    const { groupTiebreaks, bestThirdsTiebreak } = separateTiebreaksByType(normalizedTiebreaks);
    const bracketManualTiebreaks: ManualTiebreak[] = normalizedTiebreaks as ManualTiebreak[];

    // Group standings
    const groupTeams: Team[] = teams.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        group_code: t.group_code || '',
    }));

    const groupMatches = rawMatches.filter((m) => m.round === 'group');
    const groupMatchesEngine: GroupMatch[] = groupMatches.map((m) => ({
        id: m.id,
        team1_id: m.team1_id || '',
        team2_id: m.team2_id || '',
        group_code: m.group_code || '',
        round: 'group',
    }));

    const groupMatchResultsEngine: GroupMatchResult[] = rawResults
        .filter((r) => groupMatches.some((m) => m.id === r.match_id))
        .map((r) => ({
            match_id: r.match_id,
            team1_score: r.team1_score,
            team2_score: r.team2_score,
        }));

    const groupStandings = calculateGroupStandings(
        groupTeams,
        groupMatchesEngine,
        groupMatchResultsEngine,
        groupTiebreaks
    );

    // Best thirds
    const bestThirds = calculateBestThirds(groupStandings.thirdPlaceTeams, bestThirdsTiebreak);

    // Bracket matches (knockout)
    const knockoutRounds = [
        'round_of_32',
        'round_of_16',
        'quarter_final',
        'semi_final',
        'third_place',
        'final',
    ];
    const knockoutMatches = rawMatches.filter((m) => knockoutRounds.includes(m.round));

    const bracketMatches: Match[] = knockoutMatches.map((m) => ({
        id: m.id,
        num: m.match_number ?? undefined,
        round: m.round as Match['round'],
        date: m.match_date,
        time: m.match_time,
        ground: m.venue,
        team1_id: m.team1_id ?? undefined,
        team2_id: m.team2_id ?? undefined,
        team1_slot: m.team1_slot as Match['team1_slot'],
        team2_slot: m.team2_slot as Match['team2_slot'],
    }));

    const bracketMatchResults: MatchResult[] = rawResults.map((r) => ({
        match_id: r.match_id,
        team1_score: r.team1_score,
        team2_score: r.team2_score,
        winner_team_id: r.winner_team_id ?? undefined,
    }));

    // Resolve bracket
    const bracket = resolveBracket(
        bracketMatches,
        bracketMatchResults,
        groupStandings,
        bestThirds,
        bracketManualTiebreaks
    );

    const resolvedMatchMap = new Map<string, ResolvedMatch>(
        bracket.matches.map((rm) => [rm.match.id, rm])
    );

    return {
        resolvedMatches: bracket.matches,
        resolvedMatchMap,
        teams,
        teamsMap,
        groupStandings,
        bestThirds,
        rawMatches,
        rawResults,
    };
}
