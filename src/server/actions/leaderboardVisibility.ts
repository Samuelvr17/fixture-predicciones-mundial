'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function toggleLeaderboardVisibility(groupId: string, userId: string, hidden: boolean) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    const { data: globalAdmin } = await supabase
        .from('global_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

    if (!globalAdmin) {
        throw new Error('Unauthorized');
    }

    const { createServiceRoleClient } = await import('@/lib/supabase/server');
    const adminSupabase = createServiceRoleClient();

    const { error } = await adminSupabase
        .from('group_members')
        .update({
            hidden_from_leaderboard: hidden,
            hidden_from_leaderboard_at: hidden ? new Date().toISOString() : null,
            hidden_from_leaderboard_by: hidden ? user.id : null,
        })
        .eq('group_id', groupId)
        .eq('user_id', userId);

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath('/leaderboard');
    revalidatePath('/dashboard');

    return { success: true };
}
