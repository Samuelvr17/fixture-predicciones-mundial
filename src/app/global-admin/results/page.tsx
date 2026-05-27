/**
 * src/app/global-admin/results/page.tsx
 *
 * Panel de admin global para ingresar resultados oficiales del Mundial.
 * Solo accesible para usuarios en la tabla global_admins.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import GlobalResultsClient from '@/components/admin/GlobalResultsClient';

export default async function GlobalAdminResultsPage() {
  const supabase = await createClient();

  // Verificar si el usuario está autenticado
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // Verificar si el usuario es global admin
  const { data: globalAdminCheck, error: adminError } = await supabase
    .from('global_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !globalAdminCheck) {
    redirect('/dashboard');
  }

  // Fetch todos los partidos con sus resultados existentes
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      *,
      team1:teams!matches_team1_id_fkey (id, name, code),
      team2:teams!matches_team2_id_fkey (id, name, code),
      match_results (
        id,
        team1_score,
        team2_score,
        winner_team_id,
        winner:teams!match_results_winner_team_id_fkey (id, name, code)
      )
    `)
    .order('match_date', { ascending: true })
    .order('match_time', { ascending: true })
    .order('sort_order', { ascending: true });

  if (matchesError) {
    console.error('Error fetching matches:', matchesError);
    return <div>Error loading matches</div>;
  }

  // Fetch todos los equipos para el selector de ganador en eliminatorias
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, code')
    .order('name');

  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    return <div>Error loading teams</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Panel de Admin Global - Resultados</h1>
      <p className="text-gray-600 mb-6">
        Ingrese los resultados oficiales de los partidos del Mundial 2026.
      </p>
      <GlobalResultsClient 
        matches={matches || []} 
        teams={teams || []}
        currentUserId={user.id}
      />
    </div>
  );
}
