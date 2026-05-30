import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';

type Params = {
    params: Promise<{
        groupId: string;
    }>;
};

export default async function GroupDetailPage(props: Params) {
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
        .select('id, name, invite_code, prediction_deadline, is_active')
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

    // Get user's role in the group
    const { data: memberData } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', params.groupId)
        .eq('user_id', user.id)
        .single();

    const userRole = memberData?.role || 'member';
    const isLeader = userRole === 'leader';

    // Count members
    const { count: memberCount } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', params.groupId);

    // Check if deadline has passed
    const now = new Date();
    const deadline = new Date(group.prediction_deadline);
    const isDeadlinePassed = now > deadline;
    const deadlineStatus = isDeadlinePassed ? 'cerrado' : 'abierto';

    // Format deadline for display
    const deadlineFormatted = deadline.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <AppShell
            title={group.name}
            groupId={params.groupId}
            groupName={group.name}
            headerMeta={
                <div className="flex flex-wrap gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                    <span>Código: <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{group.invite_code}</span></span>
                    <span>•</span>
                    <span>Miembros: {memberCount || 0}</span>
                    <span>•</span>
                    <span>Tu rol: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{isLeader ? 'Líder' : 'Miembro'}</span></span>
                </div>
            }
        >
                {/* Deadline Status Banner */}
                <div className={`mb-8 p-4 rounded-lg border ${
                    isDeadlinePassed
                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                        : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                            isDeadlinePassed ? 'bg-amber-500' : 'bg-green-500'
                        }`} />
                        <div>
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                Predicciones: {deadlineStatus.toUpperCase()}
                            </p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                Deadline: {deadlineFormatted}
                            </p>
                        </div>
                    </div>
                    {isDeadlinePassed ? (
                        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                            ⚠️ El plazo para hacer predicciones ha cerrado. Ya no se pueden modificar las predicciones.
                        </p>
                    ) : (
                        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
                            ✨ ¡Aún tienes tiempo! Completa tus predicciones antes del deadline.
                        </p>
                    )}
                </div>

                {/* Quick Access Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {/* My Predictions */}
                    <Link
                        href={`/groups/${params.groupId}/my-predictions`}
                        className="group bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                            </div>
                            <svg className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Mis Predicciones</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {isDeadlinePassed ? 'Ver tus predicciones' : 'Editar tus predicciones'}
                        </p>
                    </Link>

                    {/* Members */}
                    <Link
                        href={`/groups/${params.groupId}/members`}
                        className="group bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <svg className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Miembros</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Ver miembros y sus predicciones
                        </p>
                    </Link>

                    {/* Matches */}
                    <Link
                        href={`/groups/${params.groupId}/matches`}
                        className="group bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-green-300 dark:hover:border-green-700 hover:shadow-md transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <svg className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Calendario</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Ver todos los partidos del torneo
                        </p>
                    </Link>

                    {/* Bracket */}
                    <Link
                        href={`/groups/${params.groupId}/bracket`}
                        className="group bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                </svg>
                            </div>
                            <svg className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Bracket</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Ver el bracket de eliminatorias
                        </p>
                    </Link>

                    {/* Leaderboard */}
                    <Link
                        href={`/groups/${params.groupId}/leaderboard`}
                        className="group bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-yellow-300 dark:hover:border-yellow-700 hover:shadow-md transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <svg className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Leaderboard</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Ver tabla de posiciones del grupo
                        </p>
                    </Link>

                    {/* Global Standings */}
                    <Link
                        href="/standings"
                        className="group bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-700 hover:shadow-md transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <svg className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Standings Globales</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Ver tabla de posiciones oficial del torneo
                        </p>
                    </Link>
                </div>

                {/* Leader Actions (if applicable) */}
                {isLeader && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Opciones de Líder</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                            Como líder del grupo, puedes gestionar el código de invitación y la configuración básica del grupo.
                        </p>
                        <Link
                            href={`/groups/${params.groupId}/settings`}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Configuración del Grupo
                        </Link>
                    </div>
                )}
        </AppShell>
    );
}
