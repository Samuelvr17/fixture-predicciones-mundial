import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import TournamentResultsClient from '@/components/admin/TournamentResultsClient';
import HelpButton from '@/components/help/HelpButton';
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <HelpButton title="¿Cómo funcionan los premios del torneo?" buttonLabel="¿Cómo funciona?">
            <div className="space-y-4">
              <section>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Solo para administradores</h3>
                <p className="mt-2">
                  Esta sección es exclusiva para administradores. Aquí se definen los premios oficiales que se califican al final del torneo.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Premios oficiales</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Goleador oficial del torneo</li>
                  <li>Mejor arquero oficial del torneo</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Selección</h3>
                <p className="mt-2">
                  El administrador debe seleccionar los ganadores desde la lista controlada de jugadores candidatos.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Recálculo</h3>
                <p className="mt-2">
                  Al guardar, se recalculan los puntajes de todos los participantes.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Precaución</h3>
                <p className="mt-2">
                  No se debe llenar con datos de prueba en producción. Si falta un jugador en la lista, se debe agregar primero como candidato antes de seleccionarlo.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Resumen</h3>
                <p className="mt-2">
                  Esta pantalla se usa al final del torneo o cuando el premio oficial esté confirmado.
                </p>
              </section>
            </div>
          </HelpButton>
          <Link href="/global-admin/results" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            Resultados de partidos
          </Link>
        </div>
      </div>

      <TournamentResultsClient
        candidates={(candidates || []) as AwardCandidate[]}
        teams={(teams || []) as Team[]}
        tournamentResults={tournamentResults}
      />
    </div>
  );
}
