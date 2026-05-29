'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import { compareMatchDateTime, formatMatchDateLong } from '@/lib/utils/matchDate';
import { buildPredictedTournamentFromScores } from '@/lib/tournament/predictedTournament';

type Team = Database['public']['Tables']['teams']['Row'];
type Prediction = Database['public']['Tables']['predictions_scores']['Row'];
type SpecialPrediction = Database['public']['Tables']['predictions_specials']['Row'];

type MatchWithTeam = Database['public']['Tables']['matches']['Row'] & {
  team1: Team | null;
  team2: Team | null;
};

interface MyPredictionsClientProps {
  matches: MatchWithTeam[];
  predictionsMap: Map<string, Prediction>;
  groupId: string;
  isBeforeDeadline: boolean;
  deadline: string;
  teams: Team[];
  specialPrediction: SpecialPrediction | null;
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
  quarter_final: 'Cuartos',
  semi_final: 'Semifinales',
  third_place: 'Tercer Puesto',
  final: 'Final',
};

const KNOCKOUT_ROUNDS = new Set([
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
]);

export default function MyPredictionsClient({
  matches,
  predictionsMap,
  groupId,
  isBeforeDeadline,
  deadline,
  teams,
  specialPrediction,
}: MyPredictionsClientProps) {
  const supabase = createClient();
  const [predictions, setPredictions] = useState<Record<string, { team1: number; team2: number }>>(() => {
    const initial: Record<string, { team1: number; team2: number }> = {};
    matches.forEach((match) => {
      const pred = predictionsMap.get(match.id);
      initial[match.id] = pred
        ? {
          team1: pred.predicted_team1_score,
          team2: pred.predicted_team2_score,
        }
        : { team1: 0, team2: 0 };
    });
    return initial;
  });
  const [predictedWinners, setPredictedWinners] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    matches.forEach((match) => {
      initial[match.id] = predictionsMap.get(match.id)?.predicted_winner_team_id ?? null;
    });
    return initial;
  });
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<Record<string, boolean>>({});
  const [topScorerName, setTopScorerName] = useState(specialPrediction?.top_scorer_name || '');
  const [savingSpecials, setSavingSpecials] = useState(false);
  const [specialsError, setSpecialsError] = useState<string | null>(null);
  const [specialsSuccess, setSpecialsSuccess] = useState(false);

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

  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const teamsMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const predictedTournament = useMemo(() => {
    return buildPredictedTournamentFromScores(
      teams,
      matches,
      matches.map((match) => ({
        match_id: match.id,
        predicted_team1_score: predictions[match.id]?.team1 ?? 0,
        predicted_team2_score: predictions[match.id]?.team2 ?? 0,
        predicted_winner_team_id: predictedWinners[match.id] ?? null,
      }))
    );
  }, [matches, predictions, predictedWinners, teams]);

  const resolvedMatchMap = useMemo(() => {
    return new Map(predictedTournament.bracket.matches.map((match) => [match.match.id, match]));
  }, [predictedTournament]);

  const getDisplayTeam = (match: MatchWithTeam, side: 'team1' | 'team2') => {
    if (match.round === 'group') {
      return side === 'team1' ? match.team1 : match.team2;
    }

    const resolved = resolvedMatchMap.get(match.id);
    const teamId = side === 'team1' ? resolved?.team1_id : resolved?.team2_id;
    return teamId ? teamsMap.get(teamId) ?? null : null;
  };

  const getDisplaySlot = (match: MatchWithTeam, side: 'team1' | 'team2') => {
    if (match.round === 'group') return null;
    const resolved = resolvedMatchMap.get(match.id);
    const slot = side === 'team1' ? resolved?.team1_slot : resolved?.team2_slot;
    return slot ?? (side === 'team1' ? match.team1_slot : match.team2_slot);
  };

  const handlePredictionChange = (matchId: string, team: 'team1' | 'team2', value: string) => {
    const numValue = parseInt(value, 10);

    if (Number.isNaN(numValue) || numValue < 0) {
      setErrors((prev) => ({
        ...prev,
        [matchId]: 'Los goles deben ser un numero entero >= 0',
      }));
      return;
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });

    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: numValue,
      },
    }));
  };

  const handleSavePrediction = async (matchId: string) => {
    const pred = predictions[matchId];
    const match = matchById.get(matchId);
    if (!pred || !match) return;

    setSaving((prev) => ({ ...prev, [matchId]: true }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    setSuccess((prev) => ({ ...prev, [matchId]: false }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrors((prev) => ({ ...prev, [matchId]: 'No autenticado' }));
        return;
      }

      const isKnockout = KNOCKOUT_ROUNDS.has(match.round);
      const isDraw = pred.team1 === pred.team2;
      const resolved = resolvedMatchMap.get(matchId);
      const winnerTeamId = isKnockout && isDraw ? predictedWinners[matchId] ?? null : null;

      if (isKnockout && isDraw && resolved?.team1_id && resolved?.team2_id && !winnerTeamId) {
        setErrors((prev) => ({
          ...prev,
          [matchId]: 'Selecciona quien clasifica si el partido queda empatado a los 90 minutos',
        }));
        return;
      }

      const existingPrediction = predictionsMap.get(matchId);
      if (existingPrediction) {
        const { error } = await supabase
          .from('predictions_scores')
          .update({
            predicted_team1_score: pred.team1,
            predicted_team2_score: pred.team2,
            predicted_winner_team_id: winnerTeamId,
          })
          .eq('id', existingPrediction.id);

        if (error) {
          setErrors((prev) => ({ ...prev, [matchId]: error.message }));
        } else {
          setSuccess((prev) => ({ ...prev, [matchId]: true }));
          predictionsMap.set(matchId, {
            ...existingPrediction,
            predicted_team1_score: pred.team1,
            predicted_team2_score: pred.team2,
            predicted_winner_team_id: winnerTeamId,
          });
        }
      } else {
        const { error } = await supabase
          .from('predictions_scores')
          .insert({
            group_id: groupId,
            user_id: user.id,
            match_id: matchId,
            predicted_team1_score: pred.team1,
            predicted_team2_score: pred.team2,
            predicted_winner_team_id: winnerTeamId,
          });

        if (error) {
          setErrors((prev) => ({ ...prev, [matchId]: error.message }));
        } else {
          setSuccess((prev) => ({ ...prev, [matchId]: true }));
          const { data: newPred } = await supabase
            .from('predictions_scores')
            .select('*')
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .eq('match_id', matchId)
            .single();

          if (newPred) {
            predictionsMap.set(matchId, newPred);
          }
        }
      }
    } catch {
      setErrors((prev) => ({ ...prev, [matchId]: 'Error al guardar prediccion' }));
    } finally {
      setSaving((prev) => ({ ...prev, [matchId]: false }));
    }
  };

  const handleSaveSpecials = async () => {
    setSavingSpecials(true);
    setSpecialsError(null);
    setSpecialsSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSpecialsError('No autenticado');
        return;
      }

      const { error } = await supabase
        .from('predictions_specials')
        .upsert({
          group_id: groupId,
          user_id: user.id,
          champion_team_id: null,
          third_place_team_id: null,
          top_scorer_name: topScorerName.trim() || null,
        }, {
          onConflict: 'group_id,user_id',
        });

      if (error) {
        setSpecialsError(error.message);
      } else {
        setSpecialsSuccess(true);
      }
    } catch {
      setSpecialsError('Error al guardar predicciones especiales');
    } finally {
      setSavingSpecials(false);
    }
  };

  const champion = predictedTournament.championTeamId
    ? teamsMap.get(predictedTournament.championTeamId)?.name
    : null;
  const thirdPlace = predictedTournament.thirdPlaceTeamId
    ? teamsMap.get(predictedTournament.thirdPlaceTeamId)?.name
    : null;

  return (
    <div className="space-y-6">
      {isBeforeDeadline && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 font-medium">
            Puedes editar tus predicciones hasta: {new Date(deadline).toLocaleString('es-ES')}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Resumen derivado de tus marcadores</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          La app calcula clasificados, avances, tercer puesto y campeon desde los resultados que guardas abajo.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3">
            <span className="block text-zinc-500 dark:text-zinc-400">Campeon predicho</span>
            <span className="font-semibold">{champion || 'Pendiente'}</span>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3">
            <span className="block text-zinc-500 dark:text-zinc-400">Tercer puesto predicho</span>
            <span className="font-semibold">{thirdPlace || 'Pendiente'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Prediccion especial</h2>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Goleador del Torneo</label>
          <input
            type="text"
            value={topScorerName}
            onChange={(event) => setTopScorerName(event.target.value)}
            disabled={!isBeforeDeadline}
            placeholder="Nombre del jugador goleador"
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
          />
        </div>

        {specialsError && <div className="text-sm text-red-600 dark:text-red-400">{specialsError}</div>}
        {specialsSuccess && <div className="text-sm text-green-600 dark:text-green-400">Guardado</div>}

        {isBeforeDeadline && (
          <button
            onClick={handleSaveSpecials}
            disabled={savingSpecials}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded transition-colors"
          >
            {savingSpecials ? 'Guardando...' : 'Guardar goleador'}
          </button>
        )}
      </div>

      {Object.entries(groupedMatches).map(([round, dates]) => (
        <div key={round} className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">{ROUND_LABELS[round]}</h2>
          {round !== 'group' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
              En eliminatorias, el marcador corresponde a los 90 minutos. Si predices empate, selecciona quien clasifica.
            </div>
          )}

          {Object.entries(dates).map(([date, matchesByDate]) => (
            <div key={date} className="space-y-3">
              <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                {formatMatchDateLong(date)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {matchesByDate.map((match) => {
                  const pred = predictions[match.id] || { team1: 0, team2: 0 };
                  const isSaved = predictionsMap.has(match.id);
                  const savedPrediction = predictionsMap.get(match.id);
                  const isDraw = pred.team1 === pred.team2;
                  const isKnockout = KNOCKOUT_ROUNDS.has(match.round);
                  const team1 = getDisplayTeam(match, 'team1');
                  const team2 = getDisplayTeam(match, 'team2');
                  const team1Slot = getDisplaySlot(match, 'team1');
                  const team2Slot = getDisplaySlot(match, 'team2');
                  const hasChanges = isSaved && (
                    savedPrediction!.predicted_team1_score !== pred.team1 ||
                    savedPrediction!.predicted_team2_score !== pred.team2 ||
                    (savedPrediction!.predicted_winner_team_id ?? null) !== (isKnockout && isDraw ? predictedWinners[match.id] ?? null : null)
                  );

                  return (
                    <div key={match.id} className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4 space-y-3">
                      {match.match_number && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Partido #{match.match_number}
                        </div>
                      )}

                      <div className="space-y-2">
                        <TeamScoreRow
                          team={team1}
                          fallbackSlot={team1Slot}
                          score={pred.team1}
                          editable={isBeforeDeadline}
                          onChange={(value) => handlePredictionChange(match.id, 'team1', value)}
                        />
                        <TeamScoreRow
                          team={team2}
                          fallbackSlot={team2Slot}
                          score={pred.team2}
                          editable={isBeforeDeadline}
                          onChange={(value) => handlePredictionChange(match.id, 'team2', value)}
                        />
                      </div>

                      {isKnockout && isDraw && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Clasifica
                          </label>
                          <select
                            value={predictedWinners[match.id] ?? ''}
                            onChange={(event) => setPredictedWinners((prev) => ({
                              ...prev,
                              [match.id]: event.target.value || null,
                            }))}
                            disabled={!isBeforeDeadline || !team1 || !team2}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                          >
                            <option value="">Seleccionar clasificado</option>
                            {team1 && <option value={team1.id}>{team1.name}</option>}
                            {team2 && <option value={team2.id}>{team2.name}</option>}
                          </select>
                        </div>
                      )}

                      {errors[match.id] && <div className="text-sm text-red-600 dark:text-red-400">{errors[match.id]}</div>}
                      {success[match.id] && <div className="text-sm text-green-600 dark:text-green-400">Guardado</div>}

                      {isBeforeDeadline && (
                        <button
                          onClick={() => handleSavePrediction(match.id)}
                          disabled={saving[match.id]}
                          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded transition-colors"
                        >
                          {saving[match.id] ? 'Guardando...' : hasChanges ? 'Guardar cambios' : 'Guardar'}
                        </button>
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
          ))}
        </div>
      ))}
    </div>
  );
}

function TeamScoreRow({
  team,
  fallbackSlot,
  score,
  editable,
  onChange,
}: {
  team: Team | null;
  fallbackSlot: string | null | undefined;
  score: number;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {team ? (
          <>
            {team.flag_url && (
              <img src={team.flag_url} alt={team.name} className="w-6 h-4 object-cover" />
            )}
            <span className="font-medium truncate">{team.name}</span>
          </>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500 truncate">
            {fallbackSlot || 'Pendiente'} <span className="text-xs">(pendiente)</span>
          </span>
        )}
      </div>
      {editable ? (
        <input
          type="number"
          min="0"
          value={score}
          onChange={(event) => onChange(event.target.value)}
          className="w-16 px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded text-center bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        />
      ) : (
        <span className="font-bold text-lg">{score}</span>
      )}
    </div>
  );
}
