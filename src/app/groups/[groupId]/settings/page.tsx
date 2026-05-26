import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import GroupSettingsForm from './GroupSettingsForm';

type Params = {
    params: Promise<{
        groupId: string;
    }>;
};

export default async function GroupSettingsPage(props: Params) {
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

    // Check if user is a leader of the group
    const { data: memberData } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', params.groupId)
        .eq('user_id', user.id)
        .single();

    if (memberData?.role !== 'leader') {
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Acceso Denegado</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        Solo los líderes pueden acceder a la configuración del grupo.
                    </p>
                </div>
            </div>
        );
    }

    // Get group info
    const { data: group } = await supabase
        .from('groups')
        .select('id, name, invite_code, prediction_deadline')
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

    // Get all members with their roles
    const { data: members } = await supabase
        .from('group_members')
        .select('user_id, role, joined_at')
        .eq('group_id', params.groupId)
        .order('joined_at', { ascending: true });

    // Get profiles for all members
    const memberIds = members?.map(m => m.user_id) || [];
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', memberIds);

    // Merge member data with profiles
    const membersWithProfiles = members?.map(member => ({
        ...member,
        profile: profiles?.find(p => p.id === member.user_id)
    })) || [];

    // Check if deadline has passed
    const now = new Date();
    const deadline = new Date(group.prediction_deadline);
    const isDeadlinePassed = now > deadline;

    // Format deadline for display
    const deadlineFormatted = deadline.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Count leaders
    const leaderCount = membersWithProfiles.filter(m => m.role === 'leader').length;

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
            <div className="max-w-4xl w-full mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/groups/${params.groupId}`}
                        className="inline-flex items-center text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-4 transition-colors"
                    >
                        ← Volver al grupo
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Configuración del Grupo</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        Gestiona la configuración básica de tu grupo
                    </p>
                </div>

                <GroupSettingsForm
                    group={group}
                    members={membersWithProfiles}
                    deadlineFormatted={deadlineFormatted}
                    isDeadlinePassed={isDeadlinePassed}
                    leaderCount={leaderCount}
                />
            </div>
        </div>
    );
}
