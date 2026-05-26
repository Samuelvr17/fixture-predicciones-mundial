import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

type Params = {
    params: Promise<{
        groupId: string;
    }>;
};

export default async function GroupMembersPage(props: Params) {
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

    if (!members || members.length === 0) {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Miembros del Grupo</h1>
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
            <div className="max-w-4xl w-full mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Miembros del Grupo</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                    Grupo: {group.name}
                </p>

                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow overflow-hidden">
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {members.map((member: any) => {
                            const profile = member.profiles;
                            const isCurrentUser = user.id === member.user_id;
                            const roleLabel = member.role === 'leader' ? 'Líder' : 'Miembro';

                            return (
                                <div
                                    key={member.id}
                                    className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <div className="flex items-center space-x-4">
                                        {/* Avatar */}
                                        <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                                            {profile?.avatar_url ? (
                                                <img
                                                    src={profile.avatar_url}
                                                    alt={profile.username || 'Usuario'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                                                    {profile?.username?.[0]?.toUpperCase() || 'U'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div>
                                            <div className="font-medium">
                                                {profile?.username || 'Usuario sin nombre'}
                                                {isCurrentUser && (
                                                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                        (Tú)
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                                {roleLabel}
                                            </div>
                                        </div>
                                    </div>

                                    {/* View Predictions Button */}
                                    <Link
                                        href={`/groups/${params.groupId}/members/${member.user_id}/predictions`}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors text-sm"
                                    >
                                        Ver predicciones
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
