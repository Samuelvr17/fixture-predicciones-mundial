import { redirect } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import HelpButton from '@/components/help/HelpButton';
import MemberPredictionsClient from '@/components/predictions/MemberPredictionsClient';
import { createClient } from '@/lib/supabase/server';
import { ensureGlobalGroupMembership, GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';
import { Database } from '@/types/database.types';

type Params = {
    params: Promise<{
        userId: string;
    }>;
};

type MatchWithTeam = Database['public']['Tables']['matches']['Row'] & {
    team1: Database['public']['Tables']['teams']['Row'] | null;
    team2: Database['public']['Tables']['teams']['Row'] | null;
};

type Prediction = Database['public']['Tables']['predictions_scores']['Row'];
type SpecialPrediction = Database['public']['Tables']['predictions_specials']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

function participantsHelpButton() {
    return (
        <HelpButton title="¿Cómo funciona Participantes?" buttonLabel="¿Cómo funciona?">
            <p>
                En esta sección puedes ver todos los participantes de la quiniela global. Desde cada participante puedes abrir sus predicciones para comparar marcadores y revisar cómo va su quiniela. Las predicciones visibles corresponden al grupo global de la app.
            </p>
        </HelpButton>
    );
}

export default async function ParticipantPredictionsPage(props: Params) {
    const { userId } = await props.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    await ensureGlobalGroupMembership(supabase, user.id);

    const { data: targetMembership } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', GLOBAL_GROUP_ID)
        .eq('user_id', userId)
        .maybeSingle();

    if (!targetMembership) {
        return (
            <AppShell title="Predicciones del participante" headerActions={participantsHelpButton()}>
                <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Participante no encontrado</h2>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        No encontramos este participante en la quiniela global.
                    </p>
                </div>
            </AppShell>
        );
    }

    const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', userId)
        .maybeSingle();

    const memberName = targetProfile?.username || 'Usuario';

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
            <AppShell title="Predicciones del participante" headerActions={participantsHelpButton()}>
                <p className="text-zinc-500 dark:text-zinc-400">No hay partidos disponibles.</p>
            </AppShell>
        );
    }

    const { data: predictions } = await supabase
        .from('predictions_scores')
        .select('*')
        .eq('group_id', GLOBAL_GROUP_ID)
        .eq('user_id', userId);

    const predictionsMap = new Map(
        (predictions || []).map((prediction: Prediction) => [prediction.match_id, prediction])
    );

    const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .order('name');

    const { data: specialPredictions } = await supabase
        .from('predictions_specials')
        .select('*')
        .eq('group_id', GLOBAL_GROUP_ID)
        .eq('user_id', userId)
        .maybeSingle();

    const isOwnPredictions = user.id === userId;

    return (
        <AppShell title="Predicciones del participante" headerActions={participantsHelpButton()} maxWidthClassName="max-w-6xl">
            <MemberPredictionsClient
                matches={matches as MatchWithTeam[]}
                predictionsMap={predictionsMap}
                groupId={GLOBAL_GROUP_ID}
                teams={(teams as Team[]) || []}
                specialPrediction={specialPredictions as SpecialPrediction | null}
                memberName={memberName}
                isOwnPredictions={isOwnPredictions}
                pageTitle="Predicciones del participante"
                editHref="/predictions"
            />
        </AppShell>
    );
}
