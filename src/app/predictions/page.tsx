import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';
import MyPredictionsClient from '@/components/predictions/MyPredictionsClient';
import AppShell from '@/components/layout/AppShell';
import HelpButton from '@/components/help/HelpButton';
import { ensureGlobalGroupMembership, GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';

type MatchWithTeam = Database['public']['Tables']['matches']['Row'] & {
    team1: Database['public']['Tables']['teams']['Row'] | null;
    team2: Database['public']['Tables']['teams']['Row'] | null;
};

type Prediction = Database['public']['Tables']['predictions_scores']['Row'];
type SpecialPrediction = Database['public']['Tables']['predictions_specials']['Row'];
type PredictionManualTiebreak = Database['public']['Tables']['prediction_manual_tiebreaks']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];
type AwardCandidate = Database['public']['Tables']['award_player_candidates']['Row'] & { team?: Pick<Team, 'id' | 'name' | 'display_name_es' | 'code'> | null };

function predictionsHelpButton() {
    return (
        <HelpButton title="¿Cómo funcionan las predicciones?" buttonLabel="¿Cómo funciona?">
            <div className="space-y-4">
                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Registro de marcadores</h3>
                    <p className="mt-2">
                        Aquí registras tus marcadores para cada partido. Debes guardar cada predicción individualmente.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Fase de grupos</h3>
                    <p className="mt-2">
                        En esta fase solo escribes el marcador final que esperas.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Eliminatorias</h3>
                    <p className="mt-2">
                        En esta fase, si predices un empate en el marcador, debes indicar qué equipo clasifica a la siguiente ronda.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Construcción automática</h3>
                    <p className="mt-2">
                        El sistema usa tus marcadores para construir automáticamente tus tablas de grupo y tu llave predicha.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Desempate manual</h3>
                    <p className="mt-2">
                        Si hay empates en la tabla de grupo que el sistema no puede resolver automáticamente, aparecerá la opción de desempate manual para que ordenes los equipos empatados.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Predicciones especiales</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>Goleador del torneo</li>
                        <li>Mejor arquero del torneo</li>
                    </ul>
                    <p className="mt-2">
                        Es mejor seleccionar jugadores desde la lista controlada para evitar errores de escritura. Si el jugador no aparece, puedes usar la opción "Otro jugador".
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Cierre de predicciones</h3>
                    <p className="mt-2">
                        Después del cierre de predicciones ya no se puede editar nada.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Puntos</h3>
                    <p className="mt-2">
                        Los puntos se calculan cuando el administrador registre resultados oficiales.
                    </p>
                </section>

                <section>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Ejemplo</h3>
                    <p className="mt-2">
                        Si pones Francia 2 - 1 Brasil, estás prediciendo que Francia gana ese partido. Si en una eliminatoria pones 1 - 1, debes indicar quién avanza a la siguiente ronda.
                    </p>
                </section>
            </div>
        </HelpButton>
    );
}

export default async function GlobalPredictionsPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    await ensureGlobalGroupMembership(supabase, user.id);

    const { data: group } = await supabase
        .from('groups')
        .select('id, name, prediction_deadline')
        .eq('id', GLOBAL_GROUP_ID)
        .single();

    if (!group) {
        return (
            <AppShell title="Mis predicciones" headerActions={predictionsHelpButton()}>
                <p className="text-zinc-500 dark:text-zinc-400">No se encontró el grupo global.</p>
            </AppShell>
        );
    }

    const isBeforeDeadline = new Date(group.prediction_deadline) > new Date();

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
            team2:teams!matches_team2_id_fkey (id, name, display_name_es, code, flag_url)
        `);

    if (!matches) {
        return (
            <AppShell title="Mis predicciones" headerActions={predictionsHelpButton()}>
                <p className="text-zinc-500 dark:text-zinc-400">No hay partidos disponibles.</p>
            </AppShell>
        );
    }

    const { data: predictions } = await supabase
        .from('predictions_scores')
        .select('*')
        .eq('group_id', GLOBAL_GROUP_ID)
        .eq('user_id', user.id);

    const predictionsMap = new Map(
        (predictions || []).map((prediction: Prediction) => [prediction.match_id, prediction])
    );

    const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .order('name');

    const { data: awardCandidates } = await supabase
        .from('award_player_candidates')
        .select('*, team:teams(id, name, display_name_es, code)')
        .eq('is_active', true)
        .order('display_name');

    const { data: predictionManualTiebreaks } = await supabase
        .from('prediction_manual_tiebreaks')
        .select('*')
        .eq('group_id', GLOBAL_GROUP_ID)
        .eq('user_id', user.id);

    const { data: specialPredictions } = await supabase
        .from('predictions_specials')
        .select('*')
        .eq('group_id', GLOBAL_GROUP_ID)
        .eq('user_id', user.id)
        .single();

    return (
        <AppShell 
            title="Mis predicciones" 
            headerActions={predictionsHelpButton()}
            headerNotice={
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        La confirmación de participación se gestiona por fuera de la app. Revisa la sección Participación confirmada para ver los registros visibles.
                    </p>
                </div>
            }
        >
            {!isBeforeDeadline && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                    <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                        ⚠️ El cierre de predicciones ha pasado. No puedes editar tus predicciones.
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                        Cierre de predicciones: {new Intl.DateTimeFormat('es-CO', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                            timeZone: 'America/Bogota',
                        }).format(new Date(group.prediction_deadline))}
                    </p>
                </div>
            )}
            <MyPredictionsClient
                matches={matches as MatchWithTeam[]}
                predictionsMap={predictionsMap}
                groupId={GLOBAL_GROUP_ID}
                isBeforeDeadline={isBeforeDeadline}
                deadline={group.prediction_deadline}
                teams={teams as Team[] || []}
                specialPrediction={specialPredictions as SpecialPrediction | null}
                manualTiebreaks={(predictionManualTiebreaks || []) as PredictionManualTiebreak[]}
                awardCandidates={(awardCandidates || []) as AwardCandidate[]}
            />
        </AppShell>
    );
}
