/**
 * src/app/global-admin/tiebreaks/page.tsx
 *
 * Panel de admin global para resolver desempates manuales.
 * Solo accesible para usuarios en la tabla global_admins.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TiebreaksClient from '@/components/admin/TiebreaksClient';
import HelpButton from '@/components/help/HelpButton';

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
    .select('id, name, display_name_es, code, group_code')
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-3xl font-bold">Panel de Admin Global - Desempates</h1>
        <HelpButton title="¿Cómo funcionan los desempates?" buttonLabel="¿Cómo funciona?">
          <div className="space-y-4">
            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Solo para administradores</h3>
              <p className="mt-2">
                Esta sección es exclusiva para administradores. Sirve para resolver empates que no pudo resolver la lógica automática.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Cuándo se usa</h3>
              <p className="mt-2">
                Se usa cuando varios equipos quedan empatados después de aplicar todos los criterios automáticos y hace falta ordenarlos manualmente.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Impacto</h3>
              <p className="mt-2">
                El orden definido impacta directamente los clasificados, las llaves y los puntajes de todos los participantes.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Recálculo</h3>
              <p className="mt-2">
                Guardar cambios puede recalcular la tabla de puntuaciones y las posiciones.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Precaución</h3>
              <p className="mt-2">
                Debe usarse con cuidado y siguiendo el criterio oficial que corresponda al torneo.
              </p>
            </section>
          </div>
        </HelpButton>
      </div>
      <p className="text-gray-600 mb-6">
        Resuelva manualmente empates que el sistema automático no puede decidir.
      </p>
      <TiebreaksClient 
        teams={teams || []}
        groupMatches={groupMatches || []}
        matchResults={matchResults || []}
        manualTiebreaks={manualTiebreaks || []}
      />
    </div>
  );
}
