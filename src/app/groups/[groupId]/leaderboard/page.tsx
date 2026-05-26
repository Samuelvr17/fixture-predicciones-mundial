import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable';

type Params = {
    params: Promise<{
        groupId: string;
    }>;
};

export default async function GroupLeaderboardPage(props: Params) {
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
                <div className="max-w-6xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Acceso Denegado</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        No eres miembro de este grupo.
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
                <div className="max-w-6xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Grupo no encontrado</h1>
                </div>
            </div>
        );
    }

    // Get all group members with their profiles
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
        .eq('group_id', params.groupId)
        .order('joined_at', { ascending: true });

    // Get score breakdowns for this group
    const { data: scoreBreakdowns } = await supabase
        .from('score_breakdowns')
        .select('*')
        .eq('group_id', params.groupId);

    // Merge score breakdowns into members
    const membersWithScores = members?.map((member: any) => ({
        ...member,
        score_breakdowns: scoreBreakdowns?.find(
            (sb: any) => sb.user_id === member.user_id
        ) || null,
    })) || [];

    if (!members || members.length === 0) {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-6xl w-full mx-auto">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Tabla de Posiciones</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                        Grupo: {group.name}
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        No hay miembros en este grupo.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
            <div className="max-w-6xl w-full mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Tabla de Posiciones</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                    Grupo: {group.name}
                </p>

                <LeaderboardTable 
                    members={membersWithScores}
                    currentUserId={user.id}
                />
            </div>
        </div>
    );
}
