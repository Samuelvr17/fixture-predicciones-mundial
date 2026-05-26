/**
 * src/components/admin/GlobalResultsClient.tsx
 *
 * Client Component para el panel de admin global de resultados.
 * Maneja la interactividad de edición y guardado de resultados.
 */

'use client';

import { useState } from 'react';
import { saveMatchResult } from '@/server/actions/saveMatchResult';
import ResultMatchCard from './ResultMatchCard';

interface Team {
  id: string;
  name: string;
  code: string;
}

interface MatchResult {
  id: string;
  team1_score: number;
  team2_score: number;
  winner_team_id: string | null;
  winner: Team | null;
}

interface Match {
  id: string;
  match_number: number | null;
  round: string;
  group_code: string | null;
  team1_id: string | null;
  team2_id: string | null;
  team1_slot: string;
  team2_slot: string;
  match_date: string;
  match_time: string;
  venue: string;
  sort_order: number;
  team1: Team | null;
  team2: Team | null;
  match_results: MatchResult | null;
}

interface GlobalResultsClientProps {
  matches: Match[];
  teams: Team[];
  currentUserId: string;
}

export default function GlobalResultsClient({ matches, teams, currentUserId }: GlobalResultsClientProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Agrupar partidos por ronda
  const groupedMatches = matches.reduce((acc, match) => {
    if (!acc[match.round]) {
      acc[match.round] = [];
    }
    acc[match.round].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  const handleSaveResult = async (
    matchId: string,
    team1Score: number,
    team2Score: number,
    winnerTeamId: string | null,
    isElimination: boolean,
    team1Id: string | null,
    team2Id: string | null
  ) => {
    setSaving(matchId);
    setError(null);
    setSuccess(null);

    try {
      // Validaciones
      if (team1Score < 0 || team2Score < 0) {
        throw new Error('Los goles deben ser números enteros mayores o iguales a 0');
      }

      if (!Number.isInteger(team1Score) || !Number.isInteger(team2Score)) {
        throw new Error('Los goles deben ser números enteros');
      }

      // Para eliminatorias, debe haber un ganador
      if (isElimination && !winnerTeamId) {
        throw new Error('En partidos de eliminatoria debe seleccionar el equipo que avanza');
      }

      // Para fase de grupos, winner_team_id puede ser null (empate)
      // Pero si se proporciona, debe ser uno de los equipos del partido
      if (winnerTeamId) {
        if (winnerTeamId !== team1Id && winnerTeamId !== team2Id) {
          throw new Error('El equipo ganador debe ser uno de los dos equipos del partido');
        }
      }

      // Call server action to save result and trigger recalculation
      const result = await saveMatchResult({
        matchId,
        team1Score,
        team2Score,
        winnerTeamId,
        team1Id,
        team2Id,
      });

      if (!result.success) {
        throw new Error(result.error || 'Error al guardar el resultado');
      }

      let successMessage = 'Resultado guardado exitosamente';
      if (result.recalculationError) {
        successMessage += '. Advertencia: ' + result.recalculationError;
      }

      setSuccess(successMessage);
      setTimeout(() => setSuccess(null), 5000);

      // Recargar la página para mostrar el resultado actualizado
      window.location.reload();
    } catch (err) {
      console.error('Error saving result:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar el resultado');
    } finally {
      setSaving(null);
    }
  };

  const isEliminationRound = (round: string): boolean => {
    return [
      'round_of_32',
      'round_of_16',
      'quarter_final',
      'semi_final',
      'third_place',
      'final',
    ].includes(round);
  };

  const roundOrder = [
    'group',
    'round_of_32',
    'round_of_16',
    'quarter_final',
    'semi_final',
    'third_place',
    'final',
  ];

  const roundLabels: Record<string, string> = {
    group: 'Fase de Grupos',
    round_of_32: 'Dieciseisavos de Final',
    round_of_16: 'Octavos de Final',
    quarter_final: 'Cuartos de Final',
    semi_final: 'Semifinales',
    third_place: 'Tercer Puesto',
    final: 'Final',
  };

  return (
    <div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {roundOrder.map((round) => {
        const matchesInRound = groupedMatches[round];
        if (!matchesInRound || matchesInRound.length === 0) return null;

        return (
          <div key={round} className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{roundLabels[round]}</h2>
            <div className="grid gap-4">
              {matchesInRound.map((match) => (
                <ResultMatchCard
                  key={match.id}
                  match={match}
                  teams={teams}
                  isElimination={isEliminationRound(round)}
                  onSave={handleSaveResult}
                  saving={saving === match.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
