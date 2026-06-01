import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import HelpButton from '@/components/help/HelpButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/server';
import { ensureGlobalGroupMembership, GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';

function participantsHelpButton() {
    return (
        <HelpButton title="¿Cómo funciona Participantes?" buttonLabel="¿Cómo funciona?">
            <p>
                En esta sección puedes ver todos los participantes de la quiniela global. Desde cada participante puedes abrir sus predicciones para comparar marcadores y revisar cómo va su quiniela. Las predicciones visibles corresponden al grupo global de la app.
            </p>
        </HelpButton>
    );
}

export default async function ParticipantsPage() {
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
            joined_at,
            profiles!group_members_user_id_fkey (
                id,
                username,
                avatar_url
            )
        `)
        .eq('group_id', GLOBAL_GROUP_ID)
        .order('joined_at', { ascending: true });

    const { data: globalAdmins } = await supabase
        .from('global_admins')
        .select('user_id');

    const globalAdminIds = new Set((globalAdmins || []).map((admin) => admin.user_id));
    const visibleMembers = (members || []).filter((member) => !globalAdminIds.has(member.user_id));

    return (
        <AppShell
            title="Participantes"
            subtitle="Consulta participantes y compara predicciones de la quiniela global."
            headerActions={participantsHelpButton()}
            maxWidthClassName="max-w-4xl"
        >
            {visibleMembers.length === 0 ? (
                <EmptyState
                    title="No hay participantes todavía"
                    description="Cuando haya participantes registrados en la quiniela global, aparecerán aquí."
                />
            ) : (
                <section className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {visibleMembers.map((member) => {
                            const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
                            const username = profile?.username || 'Usuario sin nombre';
                            const isCurrentUser = user.id === member.user_id;

                            return (
                                <div
                                    key={member.id}
                                    className="flex flex-col gap-4 p-4 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-800"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                                            {profile?.avatar_url ? (
                                                <img
                                                    src={profile.avatar_url}
                                                    alt={username}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <span className="font-medium text-zinc-500 dark:text-zinc-400">
                                                    {username[0]?.toUpperCase() || 'U'}
                                                </span>
                                            )}
                                        </div>

                                        <div>
                                            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                {username}
                                                {isCurrentUser && (
                                                    <span className="ml-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                                        (Tú)
                                                    </span>
                                                )}
                                            </h2>
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                                Participante
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/participants/${member.user_id}/predictions`}
                                        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                                    >
                                        Ver predicciones
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </AppShell>
    );
}
