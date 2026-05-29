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
import { createClient } from '@/lib/supabase/server';
import { fetchOfficialBracketData } from '@/lib/tournament/officialBracket';
import GlobalResultsClient from '@/components/admin/GlobalResultsClient';

const KNOCKOUT_ROUNDS = new Set([
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
]);

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
    .select('id, name, code')
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
          ? { id: winnerTeam.id, name: winnerTeam.name, code: winnerTeam.code }
          : null,
      }
      : null;

    if (KNOCKOUT_ROUNDS.has(match.round)) {
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
          ? { id: resolvedTeam1.id, name: resolvedTeam1.name, code: resolvedTeam1.code }
          : null,
        resolvedTeam2: resolvedTeam2
          ? { id: resolvedTeam2.id, name: resolvedTeam2.name, code: resolvedTeam2.code }
          : null,
      };
    }

    // Partidos de grupo: team1_id/team2_id ya están en la BD
    const team1 = match.team1_id ? (teamsMap.get(match.team1_id) ?? null) : null;
    const team2 = match.team2_id ? (teamsMap.get(match.team2_id) ?? null) : null;
    return {
      ...match,
      team1: team1 ? { id: team1.id, name: team1.name, code: team1.code } : null,
      team2: team2 ? { id: team2.id, name: team2.name, code: team2.code } : null,
      match_results: matchResult,
      resolvedTeam1: null,
      resolvedTeam2: null,
    };
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Panel de Admin Global - Resultados</h1>
      <p className="text-gray-600 mb-6">
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
