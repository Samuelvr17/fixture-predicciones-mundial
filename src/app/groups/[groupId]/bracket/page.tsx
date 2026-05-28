import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';
import { resolveBracket, Match, MatchResult, ManualTiebreak } from '@/lib/tournament/bracket';
import { calculateGroupStandings, Team, Match as GroupMatch, MatchResult as GroupMatchResult } from '@/lib/tournament/groupStandings';
import { calculateBestThirds } from '@/lib/tournament/bestThirds';
import { normalizeManualTiebreaksFromDb, separateTiebreaksByType } from '@/lib/tournament/manualTiebreaks';
import BracketView from '@/components/bracket/BracketView';

type Params = {
    params: Promise<{
        groupId: string;
    }>;
};

export default async function GroupBracketPage(props: Params) {
    const params = await props.params;
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // Check if user is a member of the group
    const { data: isMember } = await supabase.rpc('is_group_member', {
        p_group_id: params.groupId
    });
    if (!isMember) {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Acceso Denegado</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        No eres miembro de este grupo.
                    </p>
                </div>
            </div>
        );
    }

    // Fetch all teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, name, code, group_code');

    if (!teams) {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Bracket</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        No hay equipos disponibles.
                    </p>
                </div>
            </div>
        );
    }

    // Fetch all knockout matches (round_of_32 and later)
    const { data: knockoutMatches } = await supabase
        .from('matches')
        .select('*')
        .in('round', ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']);

    if (!knockoutMatches) {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Bracket</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        No hay partidos de eliminatoria disponibles.
                    </p>
                </div>
            </div>
        );
    }

    // Fetch all match results
    const { data: matchResults } = await supabase
        .from('match_results')
        .select('*');

    // Fetch group matches for standings calculation
    const { data: groupMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('round', 'group');

    // Fetch manual tiebreaks
    const { data: manualTiebreaks } = await supabase
        .from('manual_tiebreaks')
        .select('*');

    // Convert database types to engine types
    const teamsMap = new Map<string, { name: string; code: string }>();
    for (const team of teams) {
        teamsMap.set(team.id, { name: team.name, code: team.code });
    }

    const bracketMatches: Match[] = knockoutMatches.map(m => ({
        id: m.id,
        num: m.match_number || undefined,
        round: m.round as any, // Filtered to knockout rounds only
        date: m.match_date,
        time: m.match_time,
        ground: m.venue,
        team1_id: m.team1_id || undefined,
        team2_id: m.team2_id || undefined,
        team1_slot: m.team1_slot as any,
        team2_slot: m.team2_slot as any,
    }));

    const bracketMatchResults: MatchResult[] = (matchResults || []).map(r => ({
        match_id: r.match_id,
        team1_score: r.team1_score,
        team2_score: r.team2_score,
        winner_team_id: r.winner_team_id || undefined,
    }));

    // Normalize manual tiebreaks from DB format to engine format
    const normalizedTiebreaks = normalizeManualTiebreaksFromDb(manualTiebreaks || []);
    const { groupTiebreaks, bestThirdsTiebreak } = separateTiebreaksByType(normalizedTiebreaks);
    const bracketManualTiebreaks: ManualTiebreak[] = normalizedTiebreaks;

    // Calculate group standings for bracket resolution
    const groupTeams: Team[] = teams.map(t => ({
        id: t.id,
        name: t.name,
        code: t.code,
        group_code: t.group_code || '',
    }));

    const groupMatchesEngine: GroupMatch[] = (groupMatches || []).map(m => ({
        id: m.id,
        team1_id: m.team1_id || '',
        team2_id: m.team2_id || '',
        group_code: m.group_code || '',
        round: 'group',
    }));

    const groupMatchResults: GroupMatchResult[] = (matchResults || [])
        .filter(r => {
            // Only include results for group matches
            const match = groupMatches?.find(m => m.id === r.match_id);
            return match?.round === 'group';
        })
        .map(r => ({
            match_id: r.match_id,
            team1_score: r.team1_score,
            team2_score: r.team2_score,
        }));

    const groupStandings = calculateGroupStandings(
        groupTeams,
        groupMatchesEngine,
        groupMatchResults,
        groupTiebreaks
    );

    // Calculate best thirds
    const bestThirds = calculateBestThirds(
        groupStandings.thirdPlaceTeams,
        bestThirdsTiebreak
    );

    // Resolve the bracket
    const bracket = resolveBracket(
        bracketMatches,
        bracketMatchResults,
        groupStandings,
        bestThirds,
        bracketManualTiebreaks
    );

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
            <div className="max-w-7xl w-full mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-6">Bracket Oficial</h1>
                <BracketView bracket={bracket} teams={teamsMap} />
            </div>
        </div>
    );
}
