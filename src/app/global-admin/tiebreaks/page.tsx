/**
 * src/app/global-admin/tiebreaks/page.tsx
 *
 * Panel de admin global para resolver desempates manuales.
 * Solo accesible para usuarios en la tabla global_admins.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TiebreaksClient from '@/components/admin/TiebreaksClient';

export default async function GlobalAdminTiebreaksPage() {
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

  // Fetch todos los equipos
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, code, group_code')
    .order('name');

  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    return <div>Error loading teams</div>;
  }

  // Fetch todos los partidos de fase de grupos
  const { data: groupMatches, error: matchesError } = await supabase
    .from('matches')
    .select('id, team1_id, team2_id, group_code')
    .eq('round', 'group');

  if (matchesError) {
    console.error('Error fetching matches:', matchesError);
    return <div>Error loading matches</div>;
  }

  // Fetch todos los resultados de partidos
  const { data: matchResults, error: resultsError } = await supabase
    .from('match_results')
    .select('match_id, team1_score, team2_score');

  if (resultsError) {
    console.error('Error fetching match results:', resultsError);
    return <div>Error loading match results</div>;
  }

  // Fetch desempates manuales existentes
  const { data: manualTiebreaks, error: tiebreaksError } = await supabase
    .from('manual_tiebreaks')
    .select('*')
    .order('created_at', { ascending: false });

  if (tiebreaksError) {
    console.error('Error fetching manual tiebreaks:', tiebreaksError);
    return <div>Error loading manual tiebreaks</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Panel de Admin Global - Desempates</h1>
      <p className="text-gray-600 mb-6">
        Resuelva manualmente empates que el sistema automático no puede decidir.
      </p>
      <TiebreaksClient 
        teams={teams || []}
        groupMatches={groupMatches || []}
        matchResults={matchResults || []}
        manualTiebreaks={manualTiebreaks || []}
        currentUserId={user.id}
      />
    </div>
  );
}
