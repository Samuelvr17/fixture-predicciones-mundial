'use client';

import { TeamStats } from '@/lib/tournament/groupStandings';

interface DbTeam {
  id: string;
  name: string;
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
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Grupo {groupCode}</h3>
          {isProvisional && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-1 rounded-full">
              Provisional
            </span>
          )}
        </div>
        {requiresManualTiebreak && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
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
                          alt={team.name}
                          className="w-5 h-5 object-cover rounded"
                        />
                      )}
                      <span className="font-medium">{team?.name || 'Desconocido'}</span>
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
        <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/30">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            * Equipos empatados que requieren resolución manual por el administrador
          </p>
        </div>
      )}
    </div>
  );
}
