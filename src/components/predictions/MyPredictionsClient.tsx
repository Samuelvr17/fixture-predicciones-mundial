'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Database } from '@/types/database.types';
import { compareMatchDateTime, formatMatchDateLong } from '@/lib/utils/matchDate';
import { buildPredictedTournamentFromScores } from '@/lib/tournament/predictedTournament';
import type { GroupStandings, TeamStats } from '@/lib/tournament/groupStandings';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';
import { KNOCKOUT_ROUNDS, MATCH_ROUND_ORDER, getRoundLabel } from '@/lib/tournament/display';
import AwardCandidateSelect, { type AwardCandidate } from '@/components/awards/AwardCandidateSelect';

type Team = Database['public']['Tables']['teams']['Row'];
type Prediction = Database['public']['Tables']['predictions_scores']['Row'];
type SpecialPrediction = Database['public']['Tables']['predictions_specials']['Row'];
type PredictionManualTiebreak = Database['public']['Tables']['prediction_manual_tiebreaks']['Row'];

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
  manualTiebreaks: PredictionManualTiebreak[];
  awardCandidates: AwardCandidate[];
}

export default function MyPredictionsClient({
  matches,
  predictionsMap,
  groupId,
  isBeforeDeadline,
  deadline,
  teams,
  specialPrediction,
  manualTiebreaks,
  awardCandidates,
}: MyPredictionsClientProps) {
  const supabase = createClient();
  const [predictions, setPredictions] = useState<Record<string, { team1: string; team2: string }>>(() => {
    const initial: Record<string, { team1: string; team2: string }> = {};

    matches.forEach((match) => {
      const pred = predictionsMap.get(match.id);

      initial[match.id] = pred
        ? {
          team1: pred.predicted_team1_score.toString(),
          team2: pred.predicted_team2_score.toString(),
        }
        : { team1: '0', team2: '0' };
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
  const [topScorerCandidateId, setTopScorerCandidateId] = useState<string | null>(specialPrediction?.top_scorer_candidate_id ?? null);
  const [topScorerName, setTopScorerName] = useState(specialPrediction?.top_scorer_name || '');
  const [topScorerOtherName, setTopScorerOtherName] = useState(specialPrediction?.top_scorer_other_name || (!specialPrediction?.top_scorer_candidate_id ? specialPrediction?.top_scorer_name || '' : ''));
  const [topScorerOtherTeamId, setTopScorerOtherTeamId] = useState<string | null>(specialPrediction?.top_scorer_other_team_id ?? null);
  const [bestGoalkeeperCandidateId, setBestGoalkeeperCandidateId] = useState<string | null>(specialPrediction?.best_goalkeeper_candidate_id ?? null);
  const [bestGoalkeeperName, setBestGoalkeeperName] = useState(specialPrediction?.best_goalkeeper_name || '');
  const [bestGoalkeeperOtherName, setBestGoalkeeperOtherName] = useState(specialPrediction?.best_goalkeeper_other_name || (!specialPrediction?.best_goalkeeper_candidate_id ? specialPrediction?.best_goalkeeper_name || '' : ''));
  const [bestGoalkeeperOtherTeamId, setBestGoalkeeperOtherTeamId] = useState<string | null>(specialPrediction?.best_goalkeeper_other_team_id ?? null);
  const [savingSpecials, setSavingSpecials] = useState(false);
  const [specialsError, setSpecialsError] = useState<string | null>(null);
  const [specialsSuccess, setSpecialsSuccess] = useState(false);
  const [manualTiebreakOrders, setManualTiebreakOrders] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    manualTiebreaks.forEach((tiebreak) => {
      if (tiebreak.type === 'group_tiebreak') {
        initial[tiebreak.reference] = tiebreak.ordered_team_ids;
      }
    });
    return initial;
  });
  const [savingTiebreaks, setSavingTiebreaks] = useState<Record<string, boolean>>({});
  const [tiebreakErrors, setTiebreakErrors] = useState<Record<string, string>>({});
  const [tiebreakSuccess, setTiebreakSuccess] = useState<Record<string, boolean>>({});
  const [showPredictedTables, setShowPredictedTables] = useState(false);
  const [showManualTiebreaks, setShowManualTiebreaks] = useState(false);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const roundOrderA = MATCH_ROUND_ORDER.indexOf(a.round);
      const roundOrderB = MATCH_ROUND_ORDER.indexOf(b.round);
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


  const isValidScoreInput = (value: string) => /^\d*$/.test(value);

  const parseScoreInput = (value: string) => {
    const trimmed = value.trim();

    if (trimmed === '') {
      return 0;
    }

    const parsed = Number.parseInt(trimmed, 10);

    if (Number.isNaN(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  };

  const automaticPredictedTournament = useMemo(() => {
    return buildPredictedTournamentFromScores(
      teams,
      matches,
      matches.map((match) => ({
        match_id: match.id,
        predicted_team1_score: parseScoreInput(predictions[match.id]?.team1 ?? '0'),
        predicted_team2_score: parseScoreInput(predictions[match.id]?.team2 ?? '0'),
        predicted_winner_team_id: predictedWinners[match.id] ?? null,
      }))
    );
  }, [matches, predictions, predictedWinners, teams]);

  const predictedTournament = useMemo(() => {
    return buildPredictedTournamentFromScores(
      teams,
      matches,
      matches.map((match) => ({
        match_id: match.id,
        predicted_team1_score: parseScoreInput(predictions[match.id]?.team1 ?? '0'),
        predicted_team2_score: parseScoreInput(predictions[match.id]?.team2 ?? '0'),
        predicted_winner_team_id: predictedWinners[match.id] ?? null,
      })),
      Object.entries(manualTiebreakOrders).map(([reference, orderedTeamIds]) => ({
        type: 'group' as const,
        reference,
        ordered_team_ids: orderedTeamIds,
      }))
    );
  }, [manualTiebreakOrders, matches, predictions, predictedWinners, teams]);

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
    if (!isValidScoreInput(value)) {
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
        [team]: value,
      },
    }));

    setSuccess((prev) => ({
      ...prev,
      [matchId]: false,
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

      const team1Score = parseScoreInput(pred.team1);
      const team2Score = parseScoreInput(pred.team2);
      const isKnockout = KNOCKOUT_ROUNDS.has(match.round);
      const isDraw = team1Score === team2Score;
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
            predicted_team1_score: team1Score,
            predicted_team2_score: team2Score,
            predicted_winner_team_id: winnerTeamId,
          })
          .eq('id', existingPrediction.id);

        if (error) {
          setErrors((prev) => ({ ...prev, [matchId]: error.message }));
        } else {
          setSuccess((prev) => ({ ...prev, [matchId]: true }));
          predictionsMap.set(matchId, {
            ...existingPrediction,
            predicted_team1_score: team1Score,
            predicted_team2_score: team2Score,
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
            predicted_team1_score: team1Score,
            predicted_team2_score: team2Score,
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

      const normalizedTopScorerOtherName = topScorerOtherName.trim();
      const normalizedBestGoalkeeperOtherName = bestGoalkeeperOtherName.trim();

      const topScorerCandidate = awardCandidates.find((candidate) => candidate.id === topScorerCandidateId);
      const bestGoalkeeperCandidate = awardCandidates.find((candidate) => candidate.id === bestGoalkeeperCandidateId);

      const { error } = await supabase
        .from('predictions_specials')
        .upsert({
          group_id: groupId,
          user_id: user.id,
          champion_team_id: null,
          third_place_team_id: null,
          top_scorer_candidate_id: topScorerCandidateId,
          top_scorer_name: topScorerCandidate?.display_name || normalizedTopScorerOtherName || topScorerName.trim() || null,
          top_scorer_other_name: topScorerCandidateId ? null : normalizedTopScorerOtherName || null,
          top_scorer_other_team_id: topScorerCandidateId ? null : topScorerOtherTeamId,
          best_goalkeeper_candidate_id: bestGoalkeeperCandidateId,
          best_goalkeeper_name: bestGoalkeeperCandidate?.display_name || normalizedBestGoalkeeperOtherName || bestGoalkeeperName.trim() || null,
          best_goalkeeper_other_name: bestGoalkeeperCandidateId ? null : normalizedBestGoalkeeperOtherName || null,
          best_goalkeeper_other_team_id: bestGoalkeeperCandidateId ? null : bestGoalkeeperOtherTeamId,
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

  const unresolvedGroupTiebreaks = Object.values(automaticPredictedTournament.groupStandings.standings)
    .filter((groupStanding) => groupStanding.requiresManualTiebreak && groupStanding.tiedTeams.length > 0);

  const getManualOrderForGroup = (groupCode: string, tiedTeamIds: string[]) => {
    const reference = `group_${groupCode}`;
    const tiedSet = new Set(tiedTeamIds);
    const savedOrder = manualTiebreakOrders[reference] || [];
    const orderedSaved = savedOrder.filter((teamId) => tiedSet.has(teamId));
    const missingTeams = tiedTeamIds.filter((teamId) => !orderedSaved.includes(teamId));

    return [...orderedSaved, ...missingTeams];
  };

  const moveTiebreakTeam = (reference: string, order: string[], index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;

    const nextOrder = [...order];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    setManualTiebreakOrders((prev) => ({ ...prev, [reference]: nextOrder }));
    setTiebreakSuccess((prev) => ({ ...prev, [reference]: false }));
  };

  const handleSaveManualTiebreak = async (reference: string, orderedTeamIds: string[]) => {
    setSavingTiebreaks((prev) => ({ ...prev, [reference]: true }));
    setTiebreakErrors((prev) => {
      const next = { ...prev };
      delete next[reference];
      return next;
    });
    setTiebreakSuccess((prev) => ({ ...prev, [reference]: false }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTiebreakErrors((prev) => ({ ...prev, [reference]: 'No autenticado' }));
        return;
      }

      const { error } = await supabase
        .from('prediction_manual_tiebreaks')
        .upsert({
          group_id: groupId,
          user_id: user.id,
          type: 'group_tiebreak',
          reference,
          ordered_team_ids: orderedTeamIds,
        }, {
          onConflict: 'group_id,user_id,type,reference',
        });

      if (error) {
        setTiebreakErrors((prev) => ({ ...prev, [reference]: error.message }));
      } else {
        setManualTiebreakOrders((prev) => ({ ...prev, [reference]: orderedTeamIds }));
        setTiebreakSuccess((prev) => ({ ...prev, [reference]: true }));
      }
    } catch {
      setTiebreakErrors((prev) => ({ ...prev, [reference]: 'Error al guardar desempate manual' }));
    } finally {
      setSavingTiebreaks((prev) => ({ ...prev, [reference]: false }));
    }
  };

  const predictedGroupStandings = Object.values(predictedTournament.groupStandings.standings)
    .sort((a, b) => a.group_code.localeCompare(b.group_code));

  const champion = predictedTournament.championTeamId
    ? getTeamDisplayName(teamsMap.get(predictedTournament.championTeamId))
    : null;
  const thirdPlace = predictedTournament.thirdPlaceTeamId
    ? getTeamDisplayName(teamsMap.get(predictedTournament.thirdPlaceTeamId))
    : null;

  return (
    <div className="space-y-6">
      {isBeforeDeadline && (
        <Alert variant="info">
          Puedes editar tus predicciones hasta: {new Date(deadline).toLocaleString('es-ES')}
        </Alert>
      )}

      <Card className="space-y-3 sm:space-y-4">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Resumen derivado de tus marcadores</h2>
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
      </Card>

      <Card as="section" className="space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Mis tablas predichas</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Estas posiciones se recalculan automaticamente con tus marcadores de fase de grupos. Los puestos 1 y 2 clasifican directo; el 3 queda en pelea.
            </p>
          </div>
          <Button
            onClick={() => setShowPredictedTables((current) => !current)}
            aria-expanded={showPredictedTables}
            className="shrink-0"
          >
            {showPredictedTables ? 'Ocultar tablas' : 'Ver tablas'}
          </Button>
        </div>

        {showPredictedTables && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
            {predictedGroupStandings.map((groupStanding) => (
              <PredictedGroupTable
                key={groupStanding.group_code}
                groupStanding={groupStanding}
                teamsMap={teamsMap}
              />
            ))}
          </div>
        )}
      </Card>

      {unresolvedGroupTiebreaks.length > 0 && (
        <Card className="space-y-3 border-amber-200 bg-amber-50 sm:space-y-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-amber-950 sm:text-2xl dark:text-amber-100">
                Desempates manuales de tus predicciones
              </h2>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                Hay empates no resueltos despues de los criterios automaticos. Ordena los equipos para definir tu bracket predicho.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowManualTiebreaks((current) => !current)}
              aria-expanded={showManualTiebreaks}
              className="shrink-0 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
            >
              {showManualTiebreaks ? 'Ocultar desempates' : 'Definir desempates'}
            </button>
          </div>

          {showManualTiebreaks && unresolvedGroupTiebreaks.map((groupStanding) => {
            const reference = `group_${groupStanding.group_code}`;
            const order = getManualOrderForGroup(groupStanding.group_code, groupStanding.tiedTeams);

            return (
              <div key={reference} className="bg-white/80 dark:bg-zinc-900/80 rounded-lg border border-amber-200 dark:border-amber-800 p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-amber-950 dark:text-amber-100">
                    Hay empate no resuelto en Grupo {groupStanding.group_code}. Ordena estos equipos.
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Puedes previsualizar el cambio al mover equipos; guarda el orden para mantenerlo.
                  </p>
                </div>

                <div className="space-y-2">
                  {order.map((teamId, index) => {
                    const team = teamsMap.get(teamId);

                    return (
                      <div key={teamId} className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 dark:bg-zinc-800 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 w-6">{index + 1}</span>
                          {team?.flag_url && <img src={team.flag_url} alt={getTeamDisplayName(team)} className="w-6 h-4 object-cover" />}
                          <span className="font-medium truncate">{team ? getTeamDisplayName(team) : teamId}</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveTiebreakTeam(reference, order, index, -1)}
                            disabled={!isBeforeDeadline || index === 0}
                            className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
                          >
                            Subir
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTiebreakTeam(reference, order, index, 1)}
                            disabled={!isBeforeDeadline || index === order.length - 1}
                            className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
                          >
                            Bajar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {tiebreakErrors[reference] && (
                  <div className="text-sm text-red-600 dark:text-red-400">{tiebreakErrors[reference]}</div>
                )}
                {tiebreakSuccess[reference] && (
                  <div className="text-sm text-green-700 dark:text-green-300">Orden guardado</div>
                )}

                {isBeforeDeadline && (
                  <button
                    type="button"
                    onClick={() => handleSaveManualTiebreak(reference, order)}
                    disabled={savingTiebreaks[reference]}
                    className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-400 text-white font-medium rounded transition-colors"
                  >
                    {savingTiebreaks[reference] ? 'Guardando orden...' : 'Guardar orden del desempate'}
                  </button>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Predicciones especiales</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Estas predicciones especiales se califican al final del torneo. Selecciona los jugadores desde la lista para evitar errores de escritura. Si tu jugador no aparece, usa la opción Otro jugador.
          </p>
        </div>

        <AwardCandidateSelect
          candidates={awardCandidates}
          teams={teams}
          value={topScorerCandidateId}
          onChange={(candidateId, candidate) => {
            setTopScorerCandidateId(candidateId);
            setTopScorerName(candidate?.display_name || '');
            if (candidateId) {
              setTopScorerOtherName('');
              setTopScorerOtherTeamId(null);
            }
          }}
          awardCategory="top_scorer"
          label="Goleador del torneo"
          placeholder="Busca jugador por nombre, apellido o selección"
          helpText="Selecciona un jugador de la lista para evitar errores de escritura. Si no aparece, usa Otro jugador."
          allowOther
          otherName={topScorerOtherName}
          otherTeamId={topScorerOtherTeamId}
          onOtherChange={({ name, teamId }) => {
            setTopScorerCandidateId(null);
            setTopScorerOtherName(name);
            setTopScorerOtherTeamId(teamId);
            setTopScorerName(name);
          }}
          disabled={!isBeforeDeadline}
        />

        <AwardCandidateSelect
          candidates={awardCandidates}
          teams={teams}
          value={bestGoalkeeperCandidateId}
          onChange={(candidateId, candidate) => {
            setBestGoalkeeperCandidateId(candidateId);
            setBestGoalkeeperName(candidate?.display_name || '');
            if (candidateId) {
              setBestGoalkeeperOtherName('');
              setBestGoalkeeperOtherTeamId(null);
            }
          }}
          awardCategory="best_goalkeeper"
          label="Mejor arquero del torneo"
          placeholder="Busca arquero por nombre, apellido o selección"
          helpText="Selecciona el arquero desde la lista. Si no aparece, usa Otro jugador."
          allowOther
          otherName={bestGoalkeeperOtherName}
          otherTeamId={bestGoalkeeperOtherTeamId}
          onOtherChange={({ name, teamId }) => {
            setBestGoalkeeperCandidateId(null);
            setBestGoalkeeperOtherName(name);
            setBestGoalkeeperOtherTeamId(teamId);
            setBestGoalkeeperName(name);
          }}
          disabled={!isBeforeDeadline}
        />

        {specialsError && <Alert variant="error">{specialsError}</Alert>}
        {specialsSuccess && <Alert variant="success">Guardado</Alert>}

        {isBeforeDeadline && (
          <Button onClick={handleSaveSpecials} disabled={savingSpecials} className="w-full">
            {savingSpecials ? 'Guardando...' : 'Guardar predicciones especiales'}
          </Button>
        )}
      </Card>

      {Object.entries(groupedMatches).map(([round, dates]) => (
        <div key={round} className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{getRoundLabel(round)}</h2>
          {round !== 'group' && (
            <Alert variant="warning" className="p-3">
              En eliminatorias, el marcador corresponde a los 90 minutos. Si predices empate, selecciona quien clasifica.
            </Alert>
          )}

          {Object.entries(dates).map(([date, matchesByDate]) => (
            <div key={date} className="space-y-3">
              <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                {formatMatchDateLong(date)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {matchesByDate.map((match) => {
                  const pred = predictions[match.id] || { team1: '0', team2: '0' };
                  const team1Score = parseScoreInput(pred.team1);
                  const team2Score = parseScoreInput(pred.team2);
                  const isSaved = predictionsMap.has(match.id);
                  const savedPrediction = predictionsMap.get(match.id);
                  const isDraw = team1Score === team2Score;
                  const isKnockout = KNOCKOUT_ROUNDS.has(match.round);
                  const team1 = getDisplayTeam(match, 'team1');
                  const team2 = getDisplayTeam(match, 'team2');
                  const team1Slot = getDisplaySlot(match, 'team1');
                  const team2Slot = getDisplaySlot(match, 'team2');
                  const hasChanges = isSaved && (
                    savedPrediction!.predicted_team1_score !== team1Score ||
                    savedPrediction!.predicted_team2_score !== team2Score ||
                    (savedPrediction!.predicted_winner_team_id ?? null) !== (isKnockout && isDraw ? predictedWinners[match.id] ?? null : null)
                  );

                  return (
                    <Card key={match.id} padding="compact" className="space-y-3">
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
                            {team1 && <option value={team1.id}>{getTeamDisplayName(team1)}</option>}
                            {team2 && <option value={team2.id}>{getTeamDisplayName(team2)}</option>}
                          </select>
                        </div>
                      )}

                      {errors[match.id] && <Alert variant="error" className="py-2">{errors[match.id]}</Alert>}
                      {success[match.id] && <Alert variant="success" className="py-2">Guardado</Alert>}

                      {isBeforeDeadline && (
                        <Button onClick={() => handleSavePrediction(match.id)} disabled={saving[match.id]} className="w-full">
                          {saving[match.id] ? 'Guardando...' : hasChanges ? 'Guardar cambios' : 'Guardar'}
                        </Button>
                      )}

                      <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                        <div>{match.match_time} <span className="text-zinc-400 dark:text-zinc-500">(Hora Colombia)</span></div>
                        <div>{match.venue}</div>
                        {match.group_code && <div>Grupo {match.group_code}</div>}
                      </div>
                    </Card>
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
  score: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {team ? (
          <>
            {team.flag_url && (
              <img src={team.flag_url} alt={getTeamDisplayName(team)} className="w-6 h-4 object-cover" />
            )}
            <span className="font-medium truncate">{getTeamDisplayName(team)}</span>
          </>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500 truncate">
            {fallbackSlot || 'Pendiente'} <span className="text-xs">(pendiente)</span>
          </span>
        )}
      </div>
      {editable ? (
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={score}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          className="w-16 px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded text-center bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        />
      ) : (
        <span className="font-bold text-lg">{score}</span>
      )}
    </div>
  );
}

function PredictedGroupTable({
  groupStanding,
  teamsMap,
}: {
  groupStanding: GroupStandings;
  teamsMap: Map<string, Team>;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Grupo {groupStanding.group_code}</h3>
          {groupStanding.requiresManualTiebreak && (
            <span className="text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-1 rounded-full">
              Empate pendiente
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 px-2 py-1">
            Clasificados directos: 1° y 2°
          </span>
          <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-1">
            Terceros en pelea: 3°
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Posición</th>
              <th className="px-3 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Selección</th>
              <th className="px-3 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">PJ</th>
              <th className="px-3 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">Puntos</th>
              <th className="px-3 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">GF</th>
              <th className="px-3 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">GC</th>
              <th className="px-3 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">DG</th>
            </tr>
          </thead>
          <tbody>
            {groupStanding.standings.map((stats, index) => (
              <PredictedGroupRow
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

      {groupStanding.requiresManualTiebreak && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/30">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Empate pendiente: los equipos marcados con * requieren desempate manual para fijar el orden final del grupo.
          </p>
        </div>
      )}
    </div>
  );
}

function PredictedGroupRow({
  stats,
  position,
  team,
  isTied,
}: {
  stats: TeamStats;
  position: number;
  team: Team | null;
  isTied: boolean;
}) {
  const rowStatus = position <= 2 ? 'direct' : position === 3 ? 'third' : 'out';
  const rowClassName = rowStatus === 'direct'
    ? 'bg-green-50/60 dark:bg-green-950/20'
    : rowStatus === 'third'
      ? 'bg-amber-50/60 dark:bg-amber-950/20'
      : '';

  return (
    <tr className={`border-t border-zinc-100 dark:border-zinc-800 ${rowClassName}`}>
      <td className="px-3 py-3 font-semibold whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span>{position}°</span>
          {rowStatus === 'direct' && (
            <span className="text-[11px] font-medium text-green-700 dark:text-green-300">Directo</span>
          )}
          {rowStatus === 'third' && (
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">En pelea</span>
          )}
          {isTied && <span className="text-xs text-amber-600 dark:text-amber-400">*</span>}
        </div>
      </td>
      <td className="px-3 py-3 min-w-44">
        <div className="flex items-center gap-2">
          {team?.flag_url && <img src={team.flag_url} alt={getTeamDisplayName(team)} className="w-6 h-4 object-cover" />}
          <span className="font-medium">{team ? getTeamDisplayName(team) : 'Desconocido'}</span>
          {team?.code && <span className="text-xs text-zinc-500 dark:text-zinc-400">({team.code})</span>}
        </div>
      </td>
      <td className="px-3 py-3 text-center">{stats.played}</td>
      <td className="px-3 py-3 text-center font-bold">{stats.points}</td>
      <td className="px-3 py-3 text-center">{stats.goalsFor}</td>
      <td className="px-3 py-3 text-center">{stats.goalsAgainst}</td>
      <td className="px-3 py-3 text-center">{stats.goalDifference}</td>
    </tr>
  );
}
