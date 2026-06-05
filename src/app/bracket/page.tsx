import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOfficialBracketData } from '@/lib/tournament/officialBracket';
import BracketView from '@/components/bracket/BracketView';
import RealtimeRefresh from '@/components/realtime/RealtimeRefresh';
import AppShell from '@/components/layout/AppShell';
import HelpButton from '@/components/help/HelpButton';
import { ensureGlobalGroupMembership, GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';

function bracketHelpButton() {
    return (
        <HelpButton title="¿Cómo funcionan las llaves?" buttonLabel="¿Cómo funciona?">
            <div className="space-y-4">
                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Cuadro de eliminatorias</h3>
                    <p className="mt-2">
                        Muestra el cuadro oficial de eliminatorias del torneo.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Equipos pendientes</h3>
                    <p className="mt-2">
                        Algunos equipos pueden aparecer como "pendiente" si aún no están definidos por clasificaciones o resultados anteriores.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Resultados oficiales</h3>
                    <p className="mt-2">
                        En la llave oficial se muestran resultados oficiales cuando existan.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Dependencia</h3>
                    <p className="mt-2">
                        La llave depende de los clasificados y resultados oficiales registrados por el administrador.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Visualización</h3>
                    <p className="mt-2">
                        En celulares puede requerir desplazamiento horizontal para ver todo el cuadro. Los conectores muestran cómo avanza cada ganador hacia la siguiente ronda.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Resumen</h3>
                    <p className="mt-2">
                        La llave permite ver visualmente el camino de los equipos en eliminatorias. Si ves "pendiente", significa que ese cupo aún depende de resultados o clasificaciones.
                    </p>
                </section>
            </div>
        </HelpButton>
    );
}

export default async function GlobalBracketPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    await ensureGlobalGroupMembership(supabase, user.id);

    let bracketData;
    try {
        bracketData = await fetchOfficialBracketData(supabase);
    } catch (err) {
        console.error('Error fetching bracket data:', err);
        return (
            <AppShell title="Llaves oficiales" headerActions={bracketHelpButton()}>
                <p className="text-zinc-500 dark:text-zinc-400">No se pudo cargar el bracket. Intenta de nuevo.</p>
            </AppShell>
        );
    }

    const { resolvedMatches, teamsMap } = bracketData;

    const bracket = {
        matches: resolvedMatches,
        pendingSlots: resolvedMatches.flatMap((match) => match.pendingSlots),
        complete: resolvedMatches.every((match) => match.pendingSlots.length === 0),
        champion: resolvedMatches.find((match) => match.match.round === 'final')?.winner_team_id,
        thirdPlace: resolvedMatches.find((match) => match.match.round === 'third_place')?.winner_team_id,
    };

    const viewTeamsMap = new Map(
        [...teamsMap.entries()].map(([id, team]) => [id, { name: team.name, display_name_es: team.display_name_es, code: team.code }])
    );

    return (
        <>
            <RealtimeRefresh
                tables={['match_results', 'manual_tiebreaks', 'tournament_results']}
                channelName={`realtime-bracket-${GLOBAL_GROUP_ID}`}
            />
            <AppShell title="Llaves oficiales" maxWidthClassName="max-w-full" headerActions={bracketHelpButton()}>
                <BracketView bracket={bracket} teams={viewTeamsMap} />
            </AppShell>
        </>
    );
}
