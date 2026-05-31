import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';
import MyPredictionsClient from '@/components/predictions/MyPredictionsClient';
import AppShell from '@/components/layout/AppShell';
import { ensureGlobalGroupMembership, GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';

type MatchWithTeam = Database['public']['Tables']['matches']['Row'] & {
    team1: Database['public']['Tables']['teams']['Row'] | null;
    team2: Database['public']['Tables']['teams']['Row'] | null;
};

type Prediction = Database['public']['Tables']['predictions_scores']['Row'];
type SpecialPrediction = Database['public']['Tables']['predictions_specials']['Row'];
type PredictionManualTiebreak = Database['public']['Tables']['prediction_manual_tiebreaks']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

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
            <AppShell title="Mis Predicciones">
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
            team1:teams!matches_team1_id_fkey (id, name, code, flag_url),
            team2:teams!matches_team2_id_fkey (id, name, code, flag_url)
        `);

    if (!matches) {
        return (
            <AppShell title="Mis Predicciones">
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
        <AppShell title="Mis Predicciones">
            {!isBeforeDeadline && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                    <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                        ⚠️ El deadline de predicciones ha pasado. No puedes editar tus predicciones.
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                        Deadline: {new Date(group.prediction_deadline).toLocaleString('es-ES')}
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
            />
        </AppShell>
    );
}
