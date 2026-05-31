import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export const GLOBAL_GROUP_ID = 'b86590c1-8ef2-448b-b93a-4233a4af5227';

export function getGlobalGroupId() {
    return GLOBAL_GROUP_ID;
}

export async function ensureGlobalGroupMembership(
    supabase: SupabaseClient<Database>,
    userId: string,
) {
    const { data: existingMembership, error: lookupError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', GLOBAL_GROUP_ID)
        .eq('user_id', userId)
        .maybeSingle();

    if (lookupError) {
        throw lookupError;
    }

    if (existingMembership) {
        return existingMembership;
    }

    const { data: insertedMembership, error: insertError } = await supabase
        .from('group_members')
        .insert({
            group_id: GLOBAL_GROUP_ID,
            user_id: userId,
            role: 'member',
        })
        .select('id')
        .single();

    if (insertError) {
        if (insertError.code === '23505') {
            return null;
        }

        throw insertError;
    }

    return insertedMembership;
}
