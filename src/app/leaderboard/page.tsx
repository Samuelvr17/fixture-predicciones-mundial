import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable';
import RealtimeRefresh from '@/components/realtime/RealtimeRefresh';
import AppShell from '@/components/layout/AppShell';
import { ensureGlobalGroupMembership, GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';

export default async function GlobalLeaderboardPage() {
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
            role,
            joined_at,
            profiles!group_members_user_id_fkey (
                id,
                username,
                avatar_url
            )
        `)
        .eq('group_id', GLOBAL_GROUP_ID)
        .order('joined_at', { ascending: true });

    const { data: scoreBreakdowns } = await supabase
        .from('score_breakdowns')
        .select('*')
        .eq('group_id', GLOBAL_GROUP_ID);

    const membersWithScores = members?.map((member: any) => ({
        ...member,
        score_breakdowns: scoreBreakdowns?.find(
            (scoreBreakdown: any) => scoreBreakdown.user_id === member.user_id
        ) || null,
    })) || [];

    return (
        <>
            <RealtimeRefresh
                tables={['score_breakdowns']}
                channelName={`realtime-leaderboard-${GLOBAL_GROUP_ID}`}
                filters={[{ table: 'score_breakdowns', filter: `group_id=eq.${GLOBAL_GROUP_ID}` }]}
            />
            <AppShell title="Tabla General">
                {membersWithScores.length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-400">No hay participantes en la tabla general.</p>
                ) : (
                    <LeaderboardTable
                        members={membersWithScores}
                        currentUserId={user.id}
                    />
                )}
            </AppShell>
        </>
    );
}
