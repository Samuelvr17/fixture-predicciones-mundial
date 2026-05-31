import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOfficialBracketData } from '@/lib/tournament/officialBracket';
import BracketView from '@/components/bracket/BracketView';
import RealtimeRefresh from '@/components/realtime/RealtimeRefresh';

type Params = {
    params: Promise<{
        groupId: string;
    }>;
};

export default async function GroupBracketPage(props: Params) {
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

    let bracketData;
    try {
        bracketData = await fetchOfficialBracketData(supabase);
    } catch (err) {
        console.error('Error fetching bracket data:', err);
        return (
            <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
                <div className="max-w-4xl w-full mx-auto">
                    <h1 className="text-2xl font-bold tracking-tight mb-4">Error</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        No se pudo cargar el bracket. Intenta de nuevo.
                    </p>
                </div>
            </div>
        );
    }

    const { resolvedMatches, teamsMap } = bracketData;

    // Build the BracketOutput shape expected by BracketView
    const bracket = {
        matches: resolvedMatches,
        pendingSlots: resolvedMatches.flatMap((m) => m.pendingSlots),
        complete: resolvedMatches.every((m) => m.pendingSlots.length === 0),
        champion: resolvedMatches.find((m) => m.match.round === 'final')?.winner_team_id,
        thirdPlace: resolvedMatches.find((m) => m.match.round === 'third_place')?.winner_team_id,
    };

    // Convert teamsMap for BracketView (expects Map<string, { name: string; code: string }>)
    const viewTeamsMap = new Map(
        [...teamsMap.entries()].map(([id, t]) => [id, { name: t.name, display_name_es: t.display_name_es, code: t.code }])
    );

    return (
        <>
            <RealtimeRefresh
                tables={['match_results', 'manual_tiebreaks', 'tournament_results']}
                channelName={`realtime-bracket-${params.groupId}`}
            />
            <div className="flex min-h-screen flex-col bg-zinc-50 p-4 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:p-6 lg:p-8">
            <div className="w-full">
                <h1 className="mb-6 text-3xl font-bold tracking-tight">Llaves oficiales</h1>
                <BracketView bracket={bracket} teams={viewTeamsMap} />
            </div>
            </div>
        </>
    );
}
