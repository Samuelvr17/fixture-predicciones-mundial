'use client';

import { TeamStats } from '@/lib/tournament/groupStandings';
import { BestThirdsOutput } from '@/lib/tournament/bestThirds';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';

interface DbTeam {
  id: string;
  name: string;
  display_name_es?: string | null;
  code: string;
  group_code: string | null;
  flag_url: string | null;
}

interface BestThirdsTableProps {
  bestThirds: BestThirdsOutput;
  teams: DbTeam[];
}

export function BestThirdsTable({ bestThirds, teams }: BestThirdsTableProps) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  if (bestThirds.pending) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-6">
        <h3 className="text-lg font-semibold mb-4">Mejores Terceros</h3>
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">
            Pendiente hasta completar todos los grupos ({bestThirds.orderedThirds.length}/12)
          </span>
        </div>
      </div>
    );
  }

  const getStatusBadge = (position: number, teamId: string) => {
    if (position <= 8) {
      // Show 'Pendiente' only when the tie at the 8/9 cut is actually unresolved
      const isTiedAtCut = bestThirds.tiedAtCut.includes(teamId);
      if (isTiedAtCut && bestThirds.requiresManualTiebreak) {
        return (
          <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-1 rounded-full">
            Pendiente
          </span>
        );
      }
      return (
        <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 px-2 py-1 rounded-full">
          Clasificado
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 px-2 py-1 rounded-full">
        Eliminado
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Mejores Terceros</h3>
          {bestThirds.requiresManualTiebreak && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-1 rounded-full">
              Requiere desempate
            </span>
          )}
        </div>
        {bestThirds.requiresManualTiebreak && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Empate en la línea de clasificación (8º lugar)
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">#</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Grupo</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Equipo</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">PTS</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">DG</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">GF</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">Estado</th>
            </tr>
          </thead>
          <tbody>
            {bestThirds.orderedThirds.map((stats, index) => {
              const team = teamMap.get(stats.team_id);
              const position = index + 1;
              const isQualified = position <= 8;

              return (
                <tr
                  key={stats.team_id}
                  className={`border-t border-zinc-100 dark:border-zinc-800 ${isQualified
                      ? 'bg-green-50/50 dark:bg-green-950/20'
                      : 'bg-red-50/50 dark:bg-red-950/20'
                    }`}
                >
                  <td className="px-4 py-3 text-center font-medium">{position}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{team?.group_code || '-'}</span>
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
                  <td className="px-4 py-3 text-center font-bold">{stats.points}</td>
                  <td className="px-4 py-3 text-center">{stats.goalDifference}</td>
                  <td className="px-4 py-3 text-center">{stats.goalsFor}</td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(position, stats.team_id)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {bestThirds.requiresManualTiebreak && (
        <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/30">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Hay equipos empatados en la línea de clasificación. El administrador debe resolver manualmente qué terceros clasifican.
          </p>
        </div>
      )}
    </div>
  );
}
