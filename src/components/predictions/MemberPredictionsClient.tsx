'use client';

import { useMemo } from 'react';
import type { Database } from '@/types/database.types';
import { compareMatchDateTime, formatMatchDateLong } from '@/lib/utils/matchDate';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';
import { buildPredictedTournamentFromScores } from '@/lib/tournament/predictedTournament';
import type { ManualTiebreak as GroupManualTiebreak } from '@/lib/tournament/groupStandings';

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
  manualTiebreaks?: PredictionManualTiebreak[];
  memberName: string;
  isOwnPredictions: boolean;
  pageTitle?: string;
  editHref?: string;
}

const ROUND_ORDER = [
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
] as const;

const ROUND_LABELS: Record<string, string> = {
  group: 'Fase de Grupos',
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos de final',
  semi_final: 'Semifinales',
  third_place: 'Tercer puesto',
  final: 'Final',
};

export default function MemberPredictionsClient({
  matches,
  predictionsMap,
  groupId,
  teams,
  specialPrediction,
  manualTiebreaks = [],
  memberName,
  isOwnPredictions,
  pageTitle,
  editHref,
}: MemberPredictionsClientProps) {
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const roundOrderA = ROUND_ORDER.indexOf(a.round);
      const roundOrderB = ROUND_ORDER.indexOf(b.round);
      if (roundOrderA !== roundOrderB) return roundOrderA - roundOrderB;

      return compareMatchDateTime(a.match_date, a.match_time, b.match_date, b.match_time);
    });
  }, [matches]);

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

  const hasPredictions = predictionsMap.size > 0 || !!specialPrediction?.top_scorer_name;

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

      {specialPrediction?.top_scorer_name && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Prediccion especial</h2>
          <div>
            <label className="block text-sm font-medium mb-2">Goleador del Torneo</label>
            <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
              {specialPrediction.top_scorer_name}
            </div>
          </div>
        </div>
      )}

      {predictionsMap.size > 0 && (
        <div className="space-y-4">
          {Object.entries(groupedMatches).map(([round, dates]) => {
            const hasPredictionsInRound = Object.values(dates).some((matchesByDate) =>
              matchesByDate.some((match) => predictionsMap.has(match.id))
            );
            if (!hasPredictionsInRound) return null;

            return (
              <div key={round} className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight">{ROUND_LABELS[round]}</h2>
                {Object.entries(dates).map(([date, matchesByDate]) => {
                  const hasPredictionsInDate = matchesByDate.some((match) => predictionsMap.has(match.id));
                  if (!hasPredictionsInDate) return null;

                  return (
                    <div key={date} className="space-y-3">
                      <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                        {formatMatchDateLong(date)}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {matchesByDate.map((match) => {
                          const pred = predictionsMap.get(match.id);
                          if (!pred) return null;

                          const team1 = getDisplayTeam(match, 'team1');
                          const team2 = getDisplayTeam(match, 'team2');
                          const qualifier = match.round === 'group' ? null : getQualifierTeam(match, pred);

                          return (
                            <div key={match.id} className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4 space-y-3">
                              {match.match_number && (
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  Partido #{match.match_number}
                                </div>
                              )}
                              <ReadOnlyTeamRow
                                team={team1}
                                fallbackSlot={getDisplaySlot(match, 'team1')}
                                score={pred.predicted_team1_score}
                              />
                              <ReadOnlyTeamRow
                                team={team2}
                                fallbackSlot={getDisplaySlot(match, 'team2')}
                                score={pred.predicted_team2_score}
                              />
                              {qualifier && (
                                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                                  Clasifica: {getTeamDisplayName(qualifier)}
                                </div>
                              )}
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                                <div>{match.match_time} <span className="text-zinc-400 dark:text-zinc-500">(Hora Colombia)</span></div>
                                <div>{match.venue}</div>
                                {match.group_code && <div>Grupo {match.group_code}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
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
