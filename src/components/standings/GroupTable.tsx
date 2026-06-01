'use client';

import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import HelpButton from '@/components/help/HelpButton';
import { TeamStats } from '@/lib/tournament/groupStandings';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';

interface DbTeam {
  id: string;
  name: string;
  display_name_es?: string | null;
  code: string;
  group_code: string | null;
  flag_url: string | null;
}

interface GroupTableProps {
  groupCode: string;
  standings: TeamStats[];
  teams: DbTeam[];
  requiresManualTiebreak: boolean;
  tiedTeams: string[];
  isProvisional: boolean;
}

export function GroupTable({
  groupCode,
  standings,
  teams,
  requiresManualTiebreak,
  tiedTeams,
  isProvisional,
}: GroupTableProps) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="border-b border-zinc-100 px-4 py-4 sm:px-6 dark:border-zinc-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <h3 className="text-lg font-semibold">Grupo {groupCode}</h3>
            <HelpButton title={`Ayuda de posiciones del Grupo ${groupCode}`} buttonLabel="Info">
              <div className="space-y-4">
                <section>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Columnas de la tabla</h3>
                  <dl className="mt-2 grid gap-2">
                    <div><dt className="inline font-semibold">PJ:</dt> <dd className="inline">Partidos jugados.</dd></div>
                    <div><dt className="inline font-semibold">G:</dt> <dd className="inline">Partidos ganados.</dd></div>
                    <div><dt className="inline font-semibold">E:</dt> <dd className="inline">Partidos empatados.</dd></div>
                    <div><dt className="inline font-semibold">P:</dt> <dd className="inline">Partidos perdidos.</dd></div>
                    <div><dt className="inline font-semibold">GF:</dt> <dd className="inline">Goles a favor.</dd></div>
                    <div><dt className="inline font-semibold">GC:</dt> <dd className="inline">Goles en contra.</dd></div>
                    <div><dt className="inline font-semibold">DG:</dt> <dd className="inline">Diferencia de gol, calculada como GF - GC.</dd></div>
                    <div><dt className="inline font-semibold">PTS:</dt> <dd className="inline">Puntos obtenidos.</dd></div>
                  </dl>
                </section>

                <section>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Clasificación</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Los puestos 1° y 2° clasifican directamente.</li>
                    <li>El puesto 3° queda en pelea para mejores terceros.</li>
                    <li>El puesto 4° queda eliminado en fase de grupos, salvo que la app muestre otro estado por reglas específicas.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Criterios de desempate automáticos</h3>
                  <p className="mt-2">
                    Si dos o más equipos quedan empatados, la app intenta ordenar automáticamente aplicando estos criterios:
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Mayor número de puntos obtenidos en los partidos entre los equipos empatados.</li>
                    <li>Mejor diferencia de goles en los partidos entre los equipos empatados.</li>
                    <li>Mayor número de goles marcados en los partidos entre los equipos empatados.</li>
                    <li>Mejor diferencia de goles en todos los partidos del grupo.</li>
                    <li>Mayor número de goles marcados en todos los partidos del grupo.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Desempate manual</h3>
                  <p className="mt-2">
                    Si después de aplicar los criterios automáticos el empate no se puede resolver, la tabla queda marcada como ‘Requiere desempate manual’. En ese caso, el administrador debe ordenar manualmente los equipos empatados para que la app pueda definir posiciones, clasificados y llaves.
                  </p>
                </section>
              </div>
            </HelpButton>
          </div>
          {isProvisional && (
            <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
              Provisional
            </span>
          )}
        </div>
        {requiresManualTiebreak && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Requiere desempate manual
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">#</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Equipo</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">PJ</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">G</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">E</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">P</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">GF</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">GC</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">DG</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">PTS</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((stats, index) => {
              const team = teamMap.get(stats.team_id);
              const isTied = tiedTeams.includes(stats.team_id);
              const position = index + 1;
              
              // Highlight qualified teams (1st and 2nd)
              const isQualified = position <= 2;
              const isThird = position === 3;

              return (
                <tr
                  key={stats.team_id}
                  className={`border-t border-zinc-100 dark:border-zinc-800 ${
                    isQualified
                      ? 'bg-green-50/50 dark:bg-green-950/20'
                      : isThird
                      ? 'bg-amber-50/50 dark:bg-amber-950/20'
                      : ''
                  }`}
                >
                  <td className="px-4 py-3 text-center font-medium">
                    {position}
                    {isTied && (
                      <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">*</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {team?.flag_url && (
                        <img
                          src={team.flag_url}
                          alt={getTeamDisplayName(team)}
                          className="w-5 h-5 object-cover rounded"
                        />
                      )}
                      <span className="font-medium">{team ? getTeamDisplayName(team) : 'Desconocido'}</span>
                      {team?.code && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          ({team.code})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">{stats.played}</td>
                  <td className="px-4 py-3 text-center">{stats.wins}</td>
                  <td className="px-4 py-3 text-center">{stats.draws}</td>
                  <td className="px-4 py-3 text-center">{stats.losses}</td>
                  <td className="px-4 py-3 text-center">{stats.goalsFor}</td>
                  <td className="px-4 py-3 text-center">{stats.goalsAgainst}</td>
                  <td className="px-4 py-3 text-center">{stats.goalDifference}</td>
                  <td className="px-4 py-3 text-center font-bold">{stats.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {requiresManualTiebreak && (
        <Alert variant="warning" className="rounded-none border-x-0 border-b-0 px-4 py-3 text-xs sm:px-6">
          Este grupo todavía tiene equipos empatados que no pudieron resolverse con los criterios automáticos. El administrador debe resolver el orden manualmente.
        </Alert>
      )}
    </Card>
  );
}
