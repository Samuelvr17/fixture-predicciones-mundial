import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';
import MyPredictionsClient from '@/components/predictions/MyPredictionsClient';

type Params = {
    params: Promise<{
        groupId: string;
    }>;
};

type MatchWithTeam = Database['public']['Tables']['matches']['Row'] & {
    team1: Database['public']['Tables']['teams']['Row'] | null;
    team2: Database['public']['Tables']['teams']['Row'] | null;
};

type Prediction = Database['public']['Tables']['predictions_scores']['Row'];
type AdvancePrediction = Database['public']['Tables']['predictions_advances']['Row'];
type SpecialPrediction = Database['public']['Tables']['predictions_specials']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

export default async function MyPredictionsPage(props: Params) {
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

    // Get group info to check deadline
    const { data: group } = await supabase
        .from('groups')
        .select('id, name, prediction_deadline')
        .eq('id', params.groupId)
        .single();

    if (!group) {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Grupo no encontrado</h1>
                </div>
            </div>
        );
    }

    // Check if deadline has passed
    const isBeforeDeadline = new Date(group.prediction_deadline) > new Date();

    // Fetch all matches with teams
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
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Mis Predicciones</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        No hay partidos disponibles.
                    </p>
                </div>
            </div>
        );
    }

    // Fetch existing predictions for this user in this group
    const { data: predictions } = await supabase
        .from('predictions_scores')
        .select('*')
        .eq('group_id', params.groupId)
        .eq('user_id', user.id);

    // Create a map of match_id -> prediction for easy lookup
    const predictionsMap = new Map(
        (predictions || []).map(p => [p.match_id, p])
    );

    // Fetch all teams
    const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .order('name');

    // Fetch existing advance predictions for this user in this group
    const { data: advancePredictions } = await supabase
        .from('predictions_advances')
        .select('*')
        .eq('group_id', params.groupId)
        .eq('user_id', user.id);

    // Create a map of team_id -> advance prediction for easy lookup
    const advancesMap = new Map(
        (advancePredictions || []).map(p => [p.team_id, p])
    );

    // Fetch existing special predictions for this user in this group
    const { data: specialPredictions } = await supabase
        .from('predictions_specials')
        .select('*')
        .eq('group_id', params.groupId)
        .eq('user_id', user.id)
        .single();

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
            <div className="max-w-6xl w-full mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Mis Predicciones</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                    Grupo: {group.name}
                </p>
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
                    groupId={params.groupId}
                    isBeforeDeadline={isBeforeDeadline}
                    deadline={group.prediction_deadline}
                    teams={teams as Team[] || []}
                    advancesMap={advancesMap}
                    specialPrediction={specialPredictions as SpecialPrediction | null}
                />
            </div>
        </div>
    );
}
