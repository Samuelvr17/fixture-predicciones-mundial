import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import TournamentResultsClient from '@/components/admin/TournamentResultsClient';
import type { Database } from '@/types/database.types';

type Team = Database['public']['Tables']['teams']['Row'];
type AwardCandidate = Database['public']['Tables']['award_player_candidates']['Row'] & { team?: Pick<Team, 'id' | 'name' | 'display_name_es' | 'code'> | null };

export default async function GlobalAdminTournamentResultsPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: globalAdminCheck, error: adminError } = await supabase
    .from('global_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !globalAdminCheck) redirect('/dashboard');

  const [{ data: teams }, { data: candidates }, { data: tournamentResults }] = await Promise.all([
    supabase.from('teams').select('*').order('name'),
    supabase
      .from('award_player_candidates')
      .select('*, team:teams(id, name, display_name_es, code)')
      .eq('is_active', true)
      .order('display_name'),
    supabase.from('tournament_results').select('*').limit(1).maybeSingle(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Resultados oficiales del torneo</h1>
          <p className="mt-2 text-gray-600">
            Configura los premios individuales oficiales que afectan la tabla general.
          </p>
        </div>
        <Link href="/global-admin/results" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
          Resultados de partidos
        </Link>
      </div>

      <TournamentResultsClient
        candidates={(candidates || []) as AwardCandidate[]}
        teams={(teams || []) as Team[]}
        tournamentResults={tournamentResults}
      />
    </div>
  );
}
