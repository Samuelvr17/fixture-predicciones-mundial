import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';
import MatchesCalendarClient from '@/components/matches/MatchesCalendarClient';
import RealtimeRefresh from '@/components/realtime/RealtimeRefresh';
import AppShell from '@/components/layout/AppShell';
import HelpButton from '@/components/help/HelpButton';
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

function matchesHelpButton() {
    return (
        <HelpButton title="¿Cómo funciona la sección de partidos?" buttonLabel="¿Cómo funciona?">
            <div className="space-y-4">
                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Calendario de partidos</h3>
                    <p className="mt-2">
                        Muestra el calendario completo del torneo con fecha, hora en Colombia, sede, grupo o ronda, y equipos participantes.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Resultados oficiales</h3>
                    <p className="mt-2">
                        Cuando el administrador registra un resultado oficial, se muestra en esta sección.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Equipos pendientes</h3>
                    <p className="mt-2">
                        En partidos de eliminatorias, algunos equipos pueden aparecer como pendientes hasta que se definan los clasificados.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Consulta</h3>
                    <p className="mt-2">
                        Esta pantalla es de consulta. Los usuarios normales no registran resultados aquí; solo el administrador puede hacerlo.
                    </p>
                </section>
            </div>
        </HelpButton>
    );
}

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
            <AppShell title="Partidos" headerActions={matchesHelpButton()}>
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
            <AppShell title="Partidos" maxWidthClassName="max-w-6xl" headerActions={matchesHelpButton()}>
                <MatchesCalendarClient matches={normalizedMatches} />
            </AppShell>
        </>
    );
}
