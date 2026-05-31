import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOfficialBracketData } from '@/lib/tournament/officialBracket';
import BracketView from '@/components/bracket/BracketView';
import RealtimeRefresh from '@/components/realtime/RealtimeRefresh';
import AppShell from '@/components/layout/AppShell';
import { ensureGlobalGroupMembership, GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';

export default async function GlobalBracketPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    await ensureGlobalGroupMembership(supabase, user.id);

    let bracketData;
    try {
        bracketData = await fetchOfficialBracketData(supabase);
    } catch (err) {
        console.error('Error fetching bracket data:', err);
        return (
            <AppShell title="Llaves oficiales">
                <p className="text-zinc-500 dark:text-zinc-400">No se pudo cargar el bracket. Intenta de nuevo.</p>
            </AppShell>
        );
    }

    const { resolvedMatches, teamsMap } = bracketData;

    const bracket = {
        matches: resolvedMatches,
        pendingSlots: resolvedMatches.flatMap((match) => match.pendingSlots),
        complete: resolvedMatches.every((match) => match.pendingSlots.length === 0),
        champion: resolvedMatches.find((match) => match.match.round === 'final')?.winner_team_id,
        thirdPlace: resolvedMatches.find((match) => match.match.round === 'third_place')?.winner_team_id,
    };

    const viewTeamsMap = new Map(
        [...teamsMap.entries()].map(([id, team]) => [id, { name: team.name, display_name_es: team.display_name_es, code: team.code }])
    );

    return (
        <>
            <RealtimeRefresh
                tables={['match_results', 'manual_tiebreaks', 'tournament_results']}
                channelName={`realtime-bracket-${GLOBAL_GROUP_ID}`}
            />
            <AppShell title="Llaves oficiales" maxWidthClassName="max-w-full">
                <BracketView bracket={bracket} teams={viewTeamsMap} />
            </AppShell>
        </>
    );
}
