/**
 * src/app/global-admin/results/page.tsx
 *
 * Panel de admin global para ingresar resultados oficiales del Mundial.
 * Solo accesible para usuarios en la tabla global_admins.
 *
 * Para partidos de eliminatorias, los equipos se resuelven dinámicamente
 * mediante el motor de bracket (fetchOfficialBracketData) en lugar de leer
 * team1_id/team2_id directamente desde la BD (que son NULL para round_of_32).
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fetchOfficialBracketData } from '@/lib/tournament/officialBracket';
import GlobalResultsClient from '@/components/admin/GlobalResultsClient';
import HelpButton from '@/components/help/HelpButton';
import { isKnockoutRound } from '@/lib/tournament/display';

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

  // Fetch todos los equipos para los selectores (fallback si resolveBracket no resuelva)
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, display_name_es, code')
    .order('name');

  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    return <div>Error loading teams</div>;
  }

  // Resolver bracket completo para obtener teams resueltos en knockout
  let bracketData;
  try {
    bracketData = await fetchOfficialBracketData(supabase);
  } catch (err) {
    console.error('Error fetching bracket data:', err);
    return <div>Error loading bracket data</div>;
  }

  const { resolvedMatchMap, teamsMap, rawMatches, rawResults } = bracketData;

  // Construir mapa de match_id -> match_result
  const resultByMatchId = new Map(rawResults.map((r) => [r.match_id, r]));

  // Enriquecer cada match con match_results + equipos resueltos para knockout
  const enrichedMatches = rawMatches.map((match) => {
    const result = resultByMatchId.get(match.id) ?? null;
    const winnerTeam = result?.winner_team_id
      ? (teamsMap.get(result.winner_team_id) ?? null)
      : null;

    const matchResult = result
      ? {
        id: result.id,
        team1_score: result.team1_score,
        team2_score: result.team2_score,
        winner_team_id: result.winner_team_id,
        winner: winnerTeam
          ? { id: winnerTeam.id, name: winnerTeam.name, display_name_es: winnerTeam.display_name_es, code: winnerTeam.code }
          : null,
      }
      : null;

    if (isKnockoutRound(match.round)) {
      // Usar teams resueltos por el motor de bracket
      const resolved = resolvedMatchMap.get(match.id);
      const resolvedTeam1 = resolved?.team1_id ? (teamsMap.get(resolved.team1_id) ?? null) : null;
      const resolvedTeam2 = resolved?.team2_id ? (teamsMap.get(resolved.team2_id) ?? null) : null;

      return {
        ...match,
        // Conservar team1_id/team2_id originales (pueden ser NULL) – no los mutamos
        team1: null,  // no viene del FK join, lo manejamos vía resolvedTeam1
        team2: null,
        match_results: matchResult,
        // Equipos resueltos dinámicamente
        resolvedTeam1: resolvedTeam1
          ? { id: resolvedTeam1.id, name: resolvedTeam1.name, display_name_es: resolvedTeam1.display_name_es, code: resolvedTeam1.code }
          : null,
        resolvedTeam2: resolvedTeam2
          ? { id: resolvedTeam2.id, name: resolvedTeam2.name, display_name_es: resolvedTeam2.display_name_es, code: resolvedTeam2.code }
          : null,
      };
    }

    // Partidos de grupo: team1_id/team2_id ya están en la BD
    const team1 = match.team1_id ? (teamsMap.get(match.team1_id) ?? null) : null;
    const team2 = match.team2_id ? (teamsMap.get(match.team2_id) ?? null) : null;
    return {
      ...match,
      team1: team1 ? { id: team1.id, name: team1.name, display_name_es: team1.display_name_es, code: team1.code } : null,
      team2: team2 ? { id: team2.id, name: team2.name, display_name_es: team2.display_name_es, code: team2.code } : null,
      match_results: matchResult,
      resolvedTeam1: null,
      resolvedTeam2: null,
    };
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Panel de Admin Global - Resultados</h1>
          <Link href="/global-admin/tournament-results" className="mt-3 inline-flex rounded-md bg-zinc-900 dark:bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:hover:bg-zinc-700 transition-colors">
            Premios del torneo
          </Link>
        </div>
        <HelpButton title="¿Cómo funciona el registro de resultados?" buttonLabel="¿Cómo funciona?">
          <div className="space-y-4">
            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Solo para administradores</h3>
              <p className="mt-2">
                Esta sección es exclusiva para administradores. Aquí se registran los resultados oficiales de los partidos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Fase de grupos</h3>
              <p className="mt-2">
                En esta fase se guarda el marcador final del partido.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Eliminatorias</h3>
              <p className="mt-2">
                En esta fase, si el marcador queda empatado, debes definir el ganador o el equipo que clasifica a la siguiente ronda.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Impacto de guardar</h3>
              <p className="mt-2">
                Guardar un resultado puede recalcular la tabla de puntuaciones, las llaves y los puntajes de todos los participantes.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Precaución</h3>
              <p className="mt-2">
                Revisa bien antes de guardar porque cada cambio afecta a todos los participantes. Si se corrige un resultado, la app recalcula los puntajes automáticamente.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Resumen</h3>
              <p className="mt-2">
                Usa esta pantalla solo con resultados oficiales confirmados. Cada cambio puede modificar la tabla de puntuaciones.
              </p>
            </section>
          </div>
        </HelpButton>
      </div>
      <p className="text-gray-600 dark:text-zinc-400 mb-6">
        Ingrese los resultados oficiales de los partidos del Mundial 2026.
      </p>
      <GlobalResultsClient
        matches={enrichedMatches}
        teams={teams || []}
        currentUserId={user.id}
      />
    </div>
  );
}
