'use client';

import { useMemo, useState } from 'react';
import type { Database } from '@/types/database.types';
import { compareMatchDateTime, formatMatchDateLong } from '@/lib/utils/matchDate';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';
import { buildPredictedTournamentFromScores } from '@/lib/tournament/predictedTournament';
import ParticipantPredictionBracketView from './ParticipantPredictionBracketView';
import type { ManualTiebreak as GroupManualTiebreak, GroupStandings } from '@/lib/tournament/groupStandings';
import { MATCH_ROUND_ORDER, getRoundLabel } from '@/lib/tournament/display';
import type { AwardCandidate } from '@/components/awards/AwardCandidateSelect';

type Team = Database['public']['Tables']['teams']['Row'];
type Prediction = Database['public']['Tables']['predictions_scores']['Row'];
type SpecialPrediction = Database['public']['Tables']['predictions_specials']['Row'];
type PredictionManualTiebreak = Database['public']['Tables']['prediction_manual_tiebreaks']['Row'];

type MatchWithTeam = Database['public']['Tables']['matches']['Row'] & {
  team1: Team | null;
  team2: Team | null;
};

interface MemberPredictionsClientProps {
  matches: MatchWithTeam[];
  predictionsMap: Map<string, Prediction>;
  groupId: string;
  teams: Team[];
  specialPrediction: SpecialPrediction | null;
  awardCandidates: AwardCandidate[];
  manualTiebreaks?: PredictionManualTiebreak[];
  memberName: string;
  isOwnPredictions: boolean;
  pageTitle?: string;
  editHref?: string;
}

export function normalizeSearchText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function teamMatchesSearch(team: Team | null | undefined, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  if (!team) return false;

  const values = [
    team.display_name_es,
    team.name,
    team.code,
  ];

  return values.some((value) =>
    normalizeSearchText(value).includes(normalizedQuery)
  );
}

export default function MemberPredictionsClient({
  matches,
  predictionsMap,
  groupId,
  teams,
  specialPrediction,
  awardCandidates,
  manualTiebreaks = [],
  memberName,
  isOwnPredictions,
  pageTitle,
  editHref,
}: MemberPredictionsClientProps) {
  const [viewMode, setViewMode] = useState<'groups' | 'knockout'>('groups');
  const [searchTerm, setSearchTerm] = useState('');

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const roundOrderA = MATCH_ROUND_ORDER.indexOf(a.round);
      const roundOrderB = MATCH_ROUND_ORDER.indexOf(b.round);
      if (roundOrderA !== roundOrderB) return roundOrderA - roundOrderB;

      return compareMatchDateTime(a.match_date, a.match_time, b.match_date, b.match_time);
    });
  }, [matches]);

  const groupStageMatches = useMemo(() => matches.filter((m) => m.round === 'group'), [matches]);

  const groupedGroupMatches = useMemo(() => {
    const groups: Record<string, MatchWithTeam[]> = {};

    groupStageMatches.forEach((match) => {
      if (!match.group_code) return;
      groups[match.group_code] ??= [];
      groups[match.group_code].push(match);
    });

    Object.values(groups).forEach((groupMatches) => {
      groupMatches.sort((a, b) => compareMatchDateTime(a.match_date, a.match_time, b.match_date, b.match_time));
    });

    return Object.entries(groups)
      .sort(([groupA], [groupB]) => groupA.localeCompare(groupB))
      .map(([groupCode, groupMatches]) => ({ groupCode, matches: groupMatches }));
  }, [groupStageMatches]);

  const groupedGroupMatchesFiltered = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchTerm);
    if (!normalizedQuery) return groupedGroupMatches;

    return groupedGroupMatches
      .map((group) => {
        const filteredMatches = group.matches.filter((match) => {
          return (
            teamMatchesSearch(match.team1, normalizedQuery) ||
            teamMatchesSearch(match.team2, normalizedQuery)
          );
        });
        return { ...group, matches: filteredMatches };
      })
      .filter((group) => group.matches.length > 0);
  }, [groupedGroupMatches, searchTerm]);

  const groupedMatches = useMemo(() => {
    const groups: Record<string, Record<string, MatchWithTeam[]>> = {};

    sortedMatches.forEach((match) => {
      groups[match.round] ??= {};
      groups[match.round][match.match_date] ??= [];
      groups[match.round][match.match_date].push(match);
    });

    return groups;
  }, [sortedMatches]);

  const predictedTournament = useMemo(() => {
    const predictions = Array.from(predictionsMap.values()).map((prediction) => ({
      match_id: prediction.match_id,
      predicted_team1_score: prediction.predicted_team1_score,
      predicted_team2_score: prediction.predicted_team2_score,
      predicted_winner_team_id: prediction.predicted_winner_team_id,
    }));

    const normalizedManualTiebreaks: GroupManualTiebreak[] = manualTiebreaks
      .filter((tiebreak) => tiebreak.type === 'group_tiebreak')
      .map((tiebreak) => ({
        type: 'group' as const,
        reference: tiebreak.reference.startsWith('group_')
          ? tiebreak.reference
          : `group_${tiebreak.reference}`,
        ordered_team_ids: tiebreak.ordered_team_ids,
      }));

    return buildPredictedTournamentFromScores(
      teams,
      matches,
      predictions,
      normalizedManualTiebreaks
    );
  }, [manualTiebreaks, matches, predictionsMap, teams]);

  const resolvedMatchMap = useMemo(() => {
    return new Map(predictedTournament.bracket.matches.map((match) => [match.match.id, match]));
  }, [predictedTournament]);

  const teamsMap = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team]));
  }, [teams]);

  const getDisplayTeam = (match: MatchWithTeam, side: 'team1' | 'team2') => {
    if (match.round === 'group') {
      return side === 'team1' ? match.team1 : match.team2;
    }

    const resolved = resolvedMatchMap.get(match.id);
    const teamId = side === 'team1' ? resolved?.team1_id : resolved?.team2_id;
    return teamId ? teamsMap.get(teamId) ?? null : null;
  };

  const getDisplaySlot = (match: MatchWithTeam, side: 'team1' | 'team2') => {
    if (match.round === 'group') {
      return side === 'team1' ? match.team1_slot : match.team2_slot;
    }

    const resolved = resolvedMatchMap.get(match.id);
    const resolvedSlot = side === 'team1' ? resolved?.team1_slot : resolved?.team2_slot;
    return resolvedSlot ?? (side === 'team1' ? match.team1_slot : match.team2_slot);
  };

  const getQualifierTeam = (match: MatchWithTeam, pred: Prediction) => {
    if (pred.predicted_winner_team_id) {
      return teamsMap.get(pred.predicted_winner_team_id) ?? null;
    }

    if (pred.predicted_team1_score > pred.predicted_team2_score) {
      return getDisplayTeam(match, 'team1');
    }

    if (pred.predicted_team2_score > pred.predicted_team1_score) {
      return getDisplayTeam(match, 'team2');
    }

    return null;
  };

  const candidateMap = new Map(awardCandidates.map((candidate) => [candidate.id, candidate]));
  const teamMapForSpecials = new Map(teams.map((team) => [team.id, team]));

  const formatSpecialPrediction = (category: 'top_scorer' | 'best_goalkeeper') => {
    if (!specialPrediction) return null;
    const candidateId = category === 'top_scorer'
      ? specialPrediction.top_scorer_candidate_id
      : specialPrediction.best_goalkeeper_candidate_id;
    const otherName = category === 'top_scorer'
      ? specialPrediction.top_scorer_other_name
      : specialPrediction.best_goalkeeper_other_name;
    const otherTeamId = category === 'top_scorer'
      ? specialPrediction.top_scorer_other_team_id
      : specialPrediction.best_goalkeeper_other_team_id;
    const fallbackName = category === 'top_scorer'
      ? specialPrediction.top_scorer_name
      : specialPrediction.best_goalkeeper_name;

    if (candidateId) {
      const candidate = candidateMap.get(candidateId);
      if (candidate) {
        const teamLabel = candidate.team ? getTeamDisplayName(candidate.team as Team) : candidate.team_code;
        return teamLabel ? `${candidate.display_name} · ${teamLabel}` : candidate.display_name;
      }
    }

    if (otherName) {
      const team = otherTeamId ? teamMapForSpecials.get(otherTeamId) : null;
      return team ? `${otherName} · ${getTeamDisplayName(team)}` : otherName;
    }

    return fallbackName || null;
  };

  const topScorerDisplay = formatSpecialPrediction('top_scorer');
  const bestGoalkeeperDisplay = formatSpecialPrediction('best_goalkeeper');
  const hasPredictions = predictionsMap.size > 0 || !!topScorerDisplay || !!bestGoalkeeperDisplay;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {pageTitle || `Predicciones de ${memberName}`}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {pageTitle ? `Participante: ${memberName} · Vista de solo lectura` : 'Vista de solo lectura'}
          </p>
        </div>
        {isOwnPredictions && (
          <a
            href={editHref || `/groups/${groupId}/my-predictions`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
          >
            Editar mis predicciones
          </a>
        )}
      </div>

      {!hasPredictions && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">Sin predicciones</h3>
          <p className="text-zinc-500 dark:text-zinc-400">
            {memberName} aun no ha guardado ninguna prediccion.
          </p>
        </div>
      )}

      {(topScorerDisplay || bestGoalkeeperDisplay) && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Predicciones especiales</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-2">Goleador del torneo</label>
              <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                {topScorerDisplay || 'Pendiente'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mejor arquero del torneo</label>
              <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                {bestGoalkeeperDisplay || 'Pendiente'}
              </div>
            </div>
          </div>
        </div>
      )}

      {predictionsMap.size > 0 && (
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900" role="tablist" aria-label="Vista de predicciones">
            {(['groups', 'knockout'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${viewMode === mode
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
                  }`}
              >
                {mode === 'groups' ? 'Grupos' : 'Eliminatorias'}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <label htmlFor="searchMatch" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
              Filtrar partidos
            </label>
            <div className="relative flex-1 max-w-sm">
              <input
                id="searchMatch"
                type="text"
                placeholder="Buscar país, selección o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 whitespace-nowrap"
              >
                Limpiar
              </button>
            )}
            {viewMode === 'groups' && searchTerm && groupedGroupMatchesFiltered.length > 0 && (
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 ml-auto hidden sm:inline-block">
                Mostrando {groupedGroupMatchesFiltered.reduce((acc, g) => acc + g.matches.length, 0)} partidos
              </span>
            )}
            {viewMode === 'knockout' && searchTerm && (
              <span className="text-sm text-amber-600 dark:text-amber-400 ml-auto">
                El filtro aplica principalmente a Grupos.
              </span>
            )}
          </div>

          {viewMode === 'groups' ? (
            <div className="space-y-4">
              {groupedGroupMatchesFiltered.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-lg shadow border border-zinc-100 dark:border-zinc-800">
                  <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
                    No se encontraron partidos para ese filtro.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groupedGroupMatchesFiltered.map(({ groupCode, matches: groupMatches }) => {
                    const groupStanding = predictedTournament.groupStandings.standings[groupCode];
                    return (
                      <ReadOnlyGroupPredictionCard
                        key={groupCode}
                        groupCode={groupCode}
                        matches={groupMatches}
                        groupStanding={groupStanding}
                        teamsMap={teamsMap}
                        predictionsMap={predictionsMap}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <ParticipantPredictionBracketView
              bracket={predictedTournament.bracket}
              teams={teamsMap}
              predictionsMap={predictionsMap}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ReadOnlyTeamRow({
  team,
  fallbackSlot,
  score,
}: {
  team: Team | null;
  fallbackSlot: string | null;
  score: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {team ? (
          <>
            {team.flag_url && <img src={team.flag_url} alt={getTeamDisplayName(team)} className="w-6 h-4 object-cover" />}
            <span className="font-medium truncate">{getTeamDisplayName(team)}</span>
          </>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500 truncate">
            {fallbackSlot} <span className="text-xs">(pendiente)</span>
          </span>
        )}
      </div>
      <span className="font-bold text-lg">{score}</span>
    </div>
  );
}

function TeamFlag({ team, className }: { team: Team | null; className?: string }) {
  if (!team?.flag_url) return null;
  return <img src={team.flag_url} alt={getTeamDisplayName(team)} className={`h-4 w-6 object-cover ${className || ''}`} />;
}

function ReadOnlyGroupPredictionTable({
  groupStanding,
  teamsMap,
}: {
  groupStanding: GroupStandings | undefined;
  teamsMap: Map<string, Team>;
}) {
  if (!groupStanding) {
    return (
      <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
        Tabla pendiente
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-100 dark:border-zinc-800">
      <div className="overflow-x-auto">
        <table className="min-w-[560px] w-full text-xs sm:text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950/70">
            <tr>
              <th className="px-2 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">#</th>
              <th className="px-2 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">Equipo</th>
              <th className="px-2 py-2 text-center font-semibold text-zinc-500 dark:text-zinc-400">PTS</th>
              <th className="px-2 py-2 text-center font-semibold text-zinc-500 dark:text-zinc-400">PJ</th>
              <th className="px-2 py-2 text-center font-semibold text-zinc-500 dark:text-zinc-400">G</th>
              <th className="px-2 py-2 text-center font-semibold text-zinc-500 dark:text-zinc-400">E</th>
              <th className="px-2 py-2 text-center font-semibold text-zinc-500 dark:text-zinc-400">P</th>
              <th className="px-2 py-2 text-center font-semibold text-zinc-500 dark:text-zinc-400">GF</th>
              <th className="px-2 py-2 text-center font-semibold text-zinc-500 dark:text-zinc-400">GC</th>
              <th className="px-2 py-2 text-center font-semibold text-zinc-500 dark:text-zinc-400">DG</th>
            </tr>
          </thead>
          <tbody>
            {groupStanding.standings.map((stats, index) => (
              <ReadOnlyGroupPredictionTableRow
                key={stats.team_id}
                stats={stats}
                position={index + 1}
                team={teamsMap.get(stats.team_id) ?? null}
                isTied={groupStanding.tiedTeams.includes(stats.team_id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReadOnlyGroupPredictionTableRow({
  stats,
  position,
  team,
  isTied,
}: {
  stats: any;
  position: number;
  team: Team | null;
  isTied: boolean;
}) {
  const positionClassName = position <= 2
    ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
    : position === 3
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      <td className="px-2 py-2 whitespace-nowrap">
        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold ${positionClassName}`}>
          {position}
        </span>
      </td>
      <td className="min-w-44 px-2 py-2">
        <div className="flex items-center gap-2">
          <TeamFlag team={team} />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{team ? getTeamDisplayName(team) : 'Desconocido'}</span>
          {isTied && <span className="text-xs text-amber-600 dark:text-amber-400">*</span>}
        </div>
      </td>
      <td className="px-2 py-2 text-center font-bold">{stats.points}</td>
      <td className="px-2 py-2 text-center">{stats.played}</td>
      <td className="px-2 py-2 text-center">{stats.wins}</td>
      <td className="px-2 py-2 text-center">{stats.draws}</td>
      <td className="px-2 py-2 text-center">{stats.losses}</td>
      <td className="px-2 py-2 text-center">{stats.goalsFor}</td>
      <td className="px-2 py-2 text-center">{stats.goalsAgainst}</td>
      <td className="px-2 py-2 text-center">{stats.goalDifference}</td>
    </tr>
  );
}

function ReadOnlyGroupMatchRow({
  match,
  prediction,
  team1,
  team2,
}: {
  match: MatchWithTeam;
  prediction: Prediction;
  team1: Team | null;
  team2: Team | null;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 justify-end">
          {team1?.code && <span className="truncate">{team1.code}</span>}
          <TeamFlag team={team1} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex h-10 w-11 items-center justify-center rounded-md bg-white text-center font-bold dark:bg-zinc-900">
            {prediction.predicted_team1_score}
          </span>
          <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">-</span>
          <span className="inline-flex h-10 w-11 items-center justify-center rounded-md bg-white text-center font-bold dark:bg-zinc-900">
            {prediction.predicted_team2_score}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 justify-start">
          <TeamFlag team={team2} />
          {team2?.code && <span className="truncate">{team2.code}</span>}
        </div>
      </div>
    </div>
  );
}

function ReadOnlyGroupPredictionCard({
  groupCode,
  matches,
  groupStanding,
  teamsMap,
  predictionsMap,
}: {
  groupCode: string;
  matches: MatchWithTeam[];
  groupStanding: GroupStandings | undefined;
  teamsMap: Map<string, Team>;
  predictionsMap: Map<string, Prediction>;
}) {
  const completedMatches = matches.filter((match) => predictionsMap.has(match.id)).length;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4 space-y-4 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold tracking-tight">Grupo {groupCode}</h3>
        <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
          {completedMatches}/{matches.length}
        </span>
      </div>

      <ReadOnlyGroupPredictionTable groupStanding={groupStanding} teamsMap={teamsMap} />

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Partidos</h4>
        <div className="space-y-2">
          {matches.map((match) => {
            const pred = predictionsMap.get(match.id);
            if (!pred) return null;

            return (
              <ReadOnlyGroupMatchRow
                key={match.id}
                match={match}
                prediction={pred}
                team1={match.team1}
                team2={match.team2}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
