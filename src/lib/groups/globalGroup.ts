import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const GLOBAL_GROUP_ID = 'b86590c1-8ef2-448b-b93a-4233a4af5227';

export function getGlobalGroupId() {
    return GLOBAL_GROUP_ID;
}

export async function ensureGlobalGroupMembership(
    _supabase: SupabaseClient<Database>,
    userId: string,
) {
    const serviceRoleSupabase = createServiceRoleClient();

    const { data: existingMembership, error: lookupError } = await serviceRoleSupabase
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

    const { data: insertedMembership, error: upsertError } = await serviceRoleSupabase
        .from('group_members')
        .upsert(
            {
                group_id: GLOBAL_GROUP_ID,
                user_id: userId,
                role: 'member',
            },
            {
                onConflict: 'group_id,user_id',
                ignoreDuplicates: true,
            }
        )
        .select('id')
        .maybeSingle();

    if (upsertError) {
        throw upsertError;
    }

    return insertedMembership;
}
