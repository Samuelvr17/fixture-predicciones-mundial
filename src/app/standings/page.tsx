import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { calculateGroupStandings, type Team as EngineTeam, type Match as EngineMatch, type MatchResult as EngineMatchResult, type ManualTiebreak as GroupManualTiebreak } from '@/lib/tournament/groupStandings';
import { calculateBestThirds, type ManualTiebreak as BestThirdsManualTiebreak } from '@/lib/tournament/bestThirds';
import { normalizeManualTiebreaksFromDb, separateTiebreaksByType } from '@/lib/tournament/manualTiebreaks';
import { GroupTable } from '@/components/standings/GroupTable';
import { BestThirdsTable } from '@/components/standings/BestThirdsTable';
import AppShell from '@/components/layout/AppShell';

// Database types
type DbTeam = {
  id: string;
  name: string;
  code: string;
  group_code: string | null;
  flag_url: string | null;
};

type DbMatch = {
  id: string;
  team1_id: string | null;
  team2_id: string | null;
  group_code: string | null;
  round: 'group' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final';
};

type DbMatchResult = {
  match_id: string;
  team1_score: number;
  team2_score: number;
};

// Adapter functions to transform database data to engine types
function adaptTeamToEngine(team: DbTeam): EngineTeam {
  return {
    id: team.id,
    name: team.name,
    code: team.code,
    group_code: team.group_code || '',
  };
}

function adaptMatchToEngine(match: DbMatch): EngineMatch | null {
  if (!match.team1_id || !match.team2_id || !match.group_code || match.round !== 'group') {
    return null;
  }
  return {
    id: match.id,
    team1_id: match.team1_id,
    team2_id: match.team2_id,
    group_code: match.group_code,
    round: 'group',
  };
}

function adaptMatchResultToEngine(result: DbMatchResult): EngineMatchResult {
  return {
    match_id: result.match_id,
    team1_score: result.team1_score,
    team2_score: result.team2_score,
  };
}

export default async function StandingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch global data (not group-specific)
  const [teamsData, matchesData, matchResultsData, manualTiebreaksData] = await Promise.all([
    supabase.from('teams').select('*'),
    supabase.from('matches').select('*').eq('round', 'group'),
    supabase.from('match_results').select('*'),
    supabase.from('manual_tiebreaks').select('*'),
  ]);

  const teams = (teamsData.data || []) as DbTeam[];
  const matches = (matchesData.data || []) as DbMatch[];
  const matchResults = (matchResultsData.data || []) as DbMatchResult[];
  const manualTiebreaks = (manualTiebreaksData.data || []) as any[];

  // Adapt data to engine types
  const engineTeams = teams.map(adaptTeamToEngine);
  const engineMatches = matches.map(adaptMatchToEngine).filter((m): m is EngineMatch => m !== null);
  const engineMatchResults = matchResults.map(adaptMatchResultToEngine);

  // Normalize manual tiebreaks from DB format to engine format
  const normalizedTiebreaks = normalizeManualTiebreaksFromDb(manualTiebreaks);
  const { groupTiebreaks, bestThirdsTiebreak } = separateTiebreaksByType(normalizedTiebreaks);

  // Calculate standings using engines
  const groupStandingsOutput = calculateGroupStandings(engineTeams, engineMatches, engineMatchResults, groupTiebreaks);
  const bestThirdsOutput = calculateBestThirds(groupStandingsOutput.thirdPlaceTeams, bestThirdsTiebreak);

  // Check if standings are provisional (not all group matches have results)
  const totalGroupMatches = engineMatches.length;
  const matchesWithResults = new Set(engineMatchResults.map(r => r.match_id)).size;
  const isProvisional = matchesWithResults < totalGroupMatches;

  // Sort groups by code (A, B, C, etc.)
  const sortedGroupCodes = Object.keys(groupStandingsOutput.standings).sort();

  return (
    <AppShell
      title="Standings Globales"
      subtitle="Tablas de posiciones de la fase de grupos del Mundial 2026"
      maxWidthClassName="max-w-7xl"
      headerNotice={
        <>
          {isProvisional && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">
                Tablas provisionales - Faltan partidos por completar ({matchesWithResults}/{totalGroupMatches})
              </span>
            </div>
          )}
          {groupStandingsOutput.requiresManualTiebreak && (
            <div className="mt-4 flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm font-medium">
                Hay grupos que requieren desempate manual por el administrador
              </span>
            </div>
          )}
        </>
      }
    >
          {/* Group Tables */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Tablas por Grupo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedGroupCodes.map((groupCode) => {
                const groupStanding = groupStandingsOutput.standings[groupCode];
                if (!groupStanding) return null;

                return (
                  <GroupTable
                    key={groupCode}
                    groupCode={groupCode}
                    standings={groupStanding.standings}
                    teams={teams}
                    requiresManualTiebreak={groupStanding.requiresManualTiebreak}
                    tiedTeams={groupStanding.tiedTeams}
                    isProvisional={isProvisional}
                  />
                );
              })}
            </div>
          </section>

          {/* Best Thirds Table */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Mejores Terceros</h2>
            <BestThirdsTable
              bestThirds={bestThirdsOutput}
              teams={teams}
            />
          </section>
    </AppShell>
  );
}
