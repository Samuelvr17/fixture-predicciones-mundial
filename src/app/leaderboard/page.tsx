import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable';
import RealtimeRefresh from '@/components/realtime/RealtimeRefresh';
import AppShell from '@/components/layout/AppShell';
import HelpButton from '@/components/help/HelpButton';
import ScoringRulesHelpButton from '@/components/help/ScoringRulesHelpButton';
import { Alert } from '@/components/ui/Alert';
import { ensureGlobalGroupMembership, GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';

export default async function GlobalLeaderboardPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    await ensureGlobalGroupMembership(supabase, user.id);

    const { data: members } = await supabase
        .from('group_members')
        .select(`
            id,
            user_id,
            role,
            joined_at,
            profiles!group_members_user_id_fkey (
                id,
                username,
                avatar_url
            )
        `)
        .eq('group_id', GLOBAL_GROUP_ID)
        .order('joined_at', { ascending: true });

    const { data: scoreBreakdowns } = await supabase
        .from('score_breakdowns')
        .select('*')
        .eq('group_id', GLOBAL_GROUP_ID);

    const membersWithScores = members?.map((member: any) => ({
        ...member,
        score_breakdowns: scoreBreakdowns?.find(
            (scoreBreakdown: any) => scoreBreakdown.user_id === member.user_id
        ) || null,
    })) || [];

    return (
        <>
            <RealtimeRefresh
                tables={['score_breakdowns']}
                channelName={`realtime-leaderboard-${GLOBAL_GROUP_ID}`}
                filters={[{ table: 'score_breakdowns', filter: `group_id=eq.${GLOBAL_GROUP_ID}` }]}
            />
            <AppShell
                title="Tabla de puntuaciones"
                headerActions={
                    <div className="flex flex-wrap gap-2">
                        <HelpButton title="¿Cómo funciona la tabla de puntuaciones?" buttonLabel="¿Cómo funciona?">
                            <div className="space-y-4">
                                <section>
                                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Ranking de participantes</h3>
                                    <p className="mt-2">
                                        La tabla de puntuaciones muestra el ranking de todos los participantes ordenado por puntos acumulados.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Actualización de puntos</h3>
                                    <p className="mt-2">
                                        Los puntos se actualizan cuando el administrador registra resultados oficiales o premios del torneo.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Desglose de puntos</h3>
                                    <p className="mt-2">
                                        Puedes abrir el detalle de cada participante para ver de dónde salen sus puntos, que incluye:
                                    </p>
                                    <ul className="mt-2 list-disc space-y-1 pl-5">
                                        <li>Marcadores exactos en fase de grupos</li>
                                        <li>Resultados correctos en fase de grupos</li>
                                        <li>Marcadores exactos en eliminatorias</li>
                                        <li>Puntos por equipos que avanzan</li>
                                        <li>Campeón del torneo</li>
                                        <li>Tercer puesto</li>
                                        <li>Goleador del torneo</li>
                                        <li>Mejor arquero del torneo</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Resumen</h3>
                                    <p className="mt-2">
                                        La tabla de puntuaciones resume el rendimiento de cada participante. Puedes abrir el detalle para ver de dónde salen sus puntos.
                                    </p>
                                </section>
                            </div>
                        </HelpButton>
                        <ScoringRulesHelpButton />
                    </div>
                }
                headerNotice={
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                            Para participar y poder ganar premios, paga la inscripción de $120.000 COP a la cuenta Bancolombia 91249281994 o llave 3214076747. Las predicciones se pueden hacer gratis, pero solo los participantes que hicieron el pago de inscripción ganan premio.
                        </p>
                    </div>
                }
            >
                <Alert variant="info" className="mb-6">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-base">Premios de la quiniela</h3>
                        <p className="font-normal">1.º puesto — Mayor puntuación: 70% del premio neto</p>
                        <p className="font-normal">2.º puesto — Segunda mayor puntuación: 30% del premio neto</p>
                        <p className="font-normal text-sm">(después de deducir 10% para la organización, administración y gestión de la quiniela)</p>
                    </div>
                </Alert>

                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                        Los participantes ganan puntos por acertar marcadores, resultados, clasificados, campeón, tercer puesto, goleador y mejor arquero.
                    </p>
                </div>

                {membersWithScores.length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-400">No hay participantes en la tabla de puntuaciones.</p>
                ) : (
                    <LeaderboardTable
                        members={membersWithScores}
                        currentUserId={user.id}
                    />
                )}
            </AppShell>
        </>
    );
}
