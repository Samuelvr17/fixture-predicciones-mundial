import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';
import MatchesCalendarClient from '@/components/matches/MatchesCalendarClient';
import RealtimeRefresh from '@/components/realtime/RealtimeRefresh';
import AppShell from '@/components/layout/AppShell';
import { ensureGlobalGroupMembership, GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';

type MatchWithResult = Database['public']['Tables']['matches']['Row'] & {
    team1: Database['public']['Tables']['teams']['Row'] | null;
    team2: Database['public']['Tables']['teams']['Row'] | null;
    match_results: Database['public']['Tables']['match_results']['Row'][] | null;
};

type MatchWithNormalizedResult = Omit<MatchWithResult, 'match_results'> & {
    result: {
        team1_score: number;
        team2_score: number;
        winner_team_id: string | null;
    } | null;
};

export default async function GlobalMatchesPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    await ensureGlobalGroupMembership(supabase, user.id);

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
            team1:teams!matches_team1_id_fkey (id, name, display_name_es, code, flag_url),
            team2:teams!matches_team2_id_fkey (id, name, display_name_es, code, flag_url),
            match_results!match_results_match_id_fkey (
                team1_score,
                team2_score,
                winner_team_id
            )
        `);

    if (!matches) {
        return (
            <AppShell title="Partidos">
                <p className="text-zinc-500 dark:text-zinc-400">No hay partidos disponibles.</p>
            </AppShell>
        );
    }

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
        <>
            <RealtimeRefresh
                tables={['match_results']}
                channelName={`realtime-matches-${GLOBAL_GROUP_ID}`}
            />
            <AppShell title="Partidos" maxWidthClassName="max-w-6xl">
                <MatchesCalendarClient matches={normalizedMatches} />
            </AppShell>
        </>
    );
}
