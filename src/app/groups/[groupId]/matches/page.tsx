import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';
import MatchesCalendarClient from '@/components/matches/MatchesCalendarClient';

type Params = {
    params: Promise<{
        groupId: string;
    }>;
};

type MatchWithResult = Database['public']['Tables']['matches']['Row'] & {
    team1: Database['public']['Tables']['teams']['Row'] | null;
    team2: Database['public']['Tables']['teams']['Row'] | null;
    match_results: Database['public']['Tables']['match_results']['Row'][] | null;
};

export type MatchWithNormalizedResult = Omit<MatchWithResult, 'match_results'> & {
    result: {
        team1_score: number;
        team2_score: number;
        winner_team_id: string | null;
    } | null;
};

export default async function GroupMatchesPage(props: Params) {
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

    // Fetch all matches with teams and results
    const { data: matches } = await supabase
        .from('matches')
        .select(`
            id,
            match_number,
            round,
            group_code,
            match_date,
            match_time,
            venue,
            team1_id,
            team2_id,
            team1_slot,
            team2_slot,
            team1:teams!matches_team1_id_fkey (id, name, code, flag_url),
            team2:teams!matches_team2_id_fkey (id, name, code, flag_url),
            match_results!match_results_match_id_fkey (
                team1_score,
                team2_score,
                winner_team_id
            )
        `);

    if (!matches) {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Calendario de Partidos</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        No hay partidos disponibles.
                    </p>
                </div>
            </div>
        );
    }

    // Normalize match_results from array to single object or null
    const normalizedMatches: MatchWithNormalizedResult[] = (matches as MatchWithResult[]).map(match => ({
        ...match,
        result: match.match_results && match.match_results.length > 0
            ? {
                team1_score: match.match_results[0].team1_score,
                team2_score: match.match_results[0].team2_score,
                winner_team_id: match.match_results[0].winner_team_id
            }
            : null
    }));

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
            <div className="max-w-6xl w-full mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-6">Calendario de Partidos</h1>
                <MatchesCalendarClient matches={normalizedMatches} />
            </div>
        </div>
    );
}
