/**
 * src/components/admin/GlobalResultsClient.tsx
 *
 * Client Component para el panel de admin global de resultados.
 * Maneja la interactividad de edición y guardado de resultados.
 *
 * Los partidos de eliminatorias reciben resolvedTeam1/resolvedTeam2 del servidor
 * (resueltos via resolveBracket) en lugar de depender de team1_id/team2_id en la BD.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveMatchResult } from '@/server/actions/saveMatchResult';
import ResultMatchCard from './ResultMatchCard';
import { KNOCKOUT_ROUNDS, MATCH_ROUND_ORDER, getRoundLabel } from '@/lib/tournament/display';

interface Team {
  id: string;
  name: string;
  display_name_es?: string | null;
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
  team1_slot: string | null;
  team2_slot: string | null;
  match_date: string;
  match_time: string;
  venue: string;
  sort_order: number;
  team1: Team | null;
  team2: Team | null;
  match_results: MatchResult | null;
  /** Para knockout: equipo resuelto dinámicamente por el motor de bracket */
  resolvedTeam1: Team | null;
  /** Para knockout: equipo resuelto dinámicamente por el motor de bracket */
  resolvedTeam2: Team | null;
}

interface GlobalResultsClientProps {
  matches: Match[];
  teams: Team[];
  currentUserId: string;
}

export default function GlobalResultsClient({ matches, teams, currentUserId }: GlobalResultsClientProps) {
  const router = useRouter();
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
    winnerTeamId: string | null
  ) => {
    setSaving(matchId);
    setError(null);
    setSuccess(null);

    try {
      const result = await saveMatchResult({
        matchId,
        team1Score,
        team2Score,
        winnerTeamId,
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

      // Refrescar la ruta para mostrar el resultado actualizado sin recargar el navegador.
      router.refresh();
    } catch (err) {
      console.error('Error saving result:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar el resultado');
    } finally {
      setSaving(null);
    }
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

      {MATCH_ROUND_ORDER.map((round) => {
        const matchesInRound = groupedMatches[round];
        if (!matchesInRound || matchesInRound.length === 0) return null;

        return (
          <div key={round} className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{getRoundLabel(round)}</h2>
            <div className="grid gap-4">
              {matchesInRound.map((match) => (
                <ResultMatchCard
                  key={match.id}
                  match={match}
                  teams={teams}
                  isElimination={KNOCKOUT_ROUNDS.has(round)}
                  onSave={handleSaveResult}
                  saving={saving === match.id}
                  resolvedTeam1={match.resolvedTeam1}
                  resolvedTeam2={match.resolvedTeam2}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
