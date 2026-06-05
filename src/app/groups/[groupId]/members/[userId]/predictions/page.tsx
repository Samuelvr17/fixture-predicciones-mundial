import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';
import MemberPredictionsClient from '@/components/predictions/MemberPredictionsClient';

type Params = {
    params: Promise<{
        groupId: string;
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
type AwardCandidate = Database['public']['Tables']['award_player_candidates']['Row'] & { team?: Pick<Team, 'id' | 'name' | 'display_name_es' | 'code'> | null };

export default async function MemberPredictionsPage(props: Params) {
    const params = await props.params;
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // Check if current user is a member of the group
    const { data: isCurrentUserMember } = await supabase.rpc('is_group_member', {
        p_group_id: params.groupId
    });
    if (!isCurrentUserMember) {
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

    // Check if target user is a member of the same group
    const { data: isTargetUserMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', params.groupId)
        .eq('user_id', params.userId)
        .single();

    if (!isTargetUserMember) {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Usuario no encontrado</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        Este usuario no es miembro de este grupo.
                    </p>
                </div>
            </div>
        );
    }

    // Get group info
    const { data: group } = await supabase
        .from('groups')
        .select('id, name')
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

    // Get target user's profile
    const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', params.userId)
        .single();

    const memberName = targetProfile?.username || 'Usuario';

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
            team1:teams!matches_team1_id_fkey (id, name, display_name_es, code, flag_url),
            team2:teams!matches_team2_id_fkey (id, name, display_name_es, code, flag_url)
        `);

    if (!matches) {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Predicciones de {memberName}</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                        Grupo: {group.name}
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        No hay partidos disponibles.
                    </p>
                </div>
            </div>
        );
    }

    // Fetch predictions for the target user in this group
    const { data: predictions } = await supabase
        .from('predictions_scores')
        .select('*')
        .eq('group_id', params.groupId)
        .eq('user_id', params.userId);

    // Create a map of match_id -> prediction for easy lookup
    const predictionsMap = new Map(
        (predictions || []).map(p => [p.match_id, p])
    );

    // Fetch all teams
    const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .order('name');

    const { data: awardCandidates } = await supabase
        .from('award_player_candidates')
        .select('*, team:teams(id, name, display_name_es, code)')
        .eq('is_active', true)
        .order('display_name');

    // Fetch special predictions for the target user in this group
    const { data: specialPredictions } = await supabase
        .from('predictions_specials')
        .select('*')
        .eq('group_id', params.groupId)
        .eq('user_id', params.userId)
        .single();

    const isOwnPredictions = user.id === params.userId;

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
            <div className="max-w-6xl w-full mx-auto">
                <MemberPredictionsClient
                    matches={matches as MatchWithTeam[]}
                    predictionsMap={predictionsMap}
                    groupId={params.groupId}
                    teams={teams as Team[] || []}
                    specialPrediction={specialPredictions as SpecialPrediction | null}
                    awardCandidates={(awardCandidates || []) as AwardCandidate[]}
                    memberName={memberName}
                    isOwnPredictions={isOwnPredictions}
                />
            </div>
        </div>
    );
}
