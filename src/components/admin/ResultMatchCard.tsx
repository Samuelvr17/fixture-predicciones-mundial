/**
 * src/components/admin/ResultMatchCard.tsx
 *
 * Card reutilizable para mostrar y editar resultados de partidos.
 *
 * Para partidos de eliminatorias donde team1_id/team2_id son NULL en la BD,
 * acepta resolvedTeam1/resolvedTeam2 para mostrar los equipos resueltos
 * dinámicamente por el motor de bracket.
 */

'use client';

import { useState } from 'react';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';

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
}

interface ResultMatchCardProps {
  match: Match;
  teams: Team[];
  isElimination: boolean;
  onSave: (matchId: string, team1Score: number, team2Score: number, winnerTeamId: string | null) => void;
  saving: boolean;
  /** Para knockout: equipo resuelto dinámicamente por el motor de bracket */
  resolvedTeam1?: Team | null;
  /** Para knockout: equipo resuelto dinámicamente por el motor de bracket */
  resolvedTeam2?: Team | null;
}

export default function ResultMatchCard({
  match,
  teams,
  isElimination,
  onSave,
  saving,
  resolvedTeam1,
  resolvedTeam2,
}: ResultMatchCardProps) {
  const [editing, setEditing] = useState(false);
  const [team1ScoreInput, setTeam1ScoreInput] = useState(
    match.match_results?.team1_score?.toString() ?? ''
  );
  const [team2ScoreInput, setTeam2ScoreInput] = useState(
    match.match_results?.team2_score?.toString() ?? ''
  );
  const [winnerTeamId, setWinnerTeamId] = useState(match.match_results?.winner_team_id ?? null);

  const hasResult = !!match.match_results;

  // Equipo efectivo: resolver primero desde resolvedTeam, luego desde match.team
  const effectiveTeam1: Team | null = resolvedTeam1 ?? match.team1;
  const effectiveTeam2: Team | null = resolvedTeam2 ?? match.team2;

  const team1Resolved = !!effectiveTeam1;
  const team2Resolved = !!effectiveTeam2;
  const bothTeamsResolved = team1Resolved && team2Resolved;

  const parseScoreInput = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') return 0;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  const handleSave = () => {
    const team1Score = parseScoreInput(team1ScoreInput);
    const team2Score = parseScoreInput(team2ScoreInput);
    onSave(match.id, team1Score, team2Score, winnerTeamId);
    setEditing(false);
  };

  const handleCancel = () => {
    setTeam1ScoreInput(match.match_results?.team1_score?.toString() ?? '');
    setTeam2ScoreInput(match.match_results?.team2_score?.toString() ?? '');
    setWinnerTeamId(match.match_results?.winner_team_id ?? null);
    setEditing(false);
  };

  const getTeamDisplay = (team: Team | null, slot: string | null) => {
    if (team) {
      return `${getTeamDisplayName(team)} (${team.code})`;
    }
    return `Slot: ${slot ?? '?'} (pendiente)`;
  };

  const isSlotReference = (slot: string | null): boolean => {
    if (!slot) return false;
    return /^[1-3][A-L]$|^W\d+$|^L\d+$|^[1-3][A-L]\/[A-L]+$/.test(slot);
  };

  return (
    <div className="bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-lg p-3 sm:p-4 shadow-sm mb-4">
      <div className="flex flex-wrap justify-between items-start mb-3 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {match.match_number && (
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">#{match.match_number}</span>
          )}
          {match.group_code && (
            <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Grupo {match.group_code}</span>
          )}
          <span className="text-sm text-gray-500 dark:text-zinc-400">
            {match.match_date} - {match.match_time} <span className="hidden sm:inline text-gray-400 dark:text-zinc-500">(Hora Colombia)</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasResult && !editing && (
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 text-xs rounded font-medium">
              Jugado
            </span>
          )}
          {!hasResult && (
            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100 text-xs rounded font-medium">
              Pendiente
            </span>
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-zinc-400 line-clamp-1" title={match.venue}>{match.venue}</p>
      </div>

      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm leading-tight">
            {getTeamDisplay(effectiveTeam1, match.team1_slot)}
          </p>
          {!team1Resolved && isSlotReference(match.team1_slot) && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Slot pendiente
            </p>
          )}
        </div>

        {editing ? (
          <div className="flex items-center justify-center gap-2 mx-2 shrink-0">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={team1ScoreInput}
              onChange={(e) => {
                const value = e.target.value;
                if (/^\d*$/.test(value)) setTeam1ScoreInput(value);
              }}
              onFocus={(e) => e.currentTarget.select()}
              className="w-12 px-2 py-1.5 border dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded text-center text-lg shadow-inner focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={saving}
            />
            <span className="text-gray-400 dark:text-zinc-500 font-bold">-</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={team2ScoreInput}
              onChange={(e) => {
                const value = e.target.value;
                if (/^\d*$/.test(value)) setTeam2ScoreInput(value);
              }}
              onFocus={(e) => e.currentTarget.select()}
              className="w-12 px-2 py-1.5 border dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded text-center text-lg shadow-inner focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={saving}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mx-2 shrink-0 bg-gray-50 dark:bg-zinc-700/50 px-3 py-1.5 rounded-lg">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{match.match_results?.team1_score ?? '-'}</span>
            <span className="text-gray-300 dark:text-zinc-500 text-sm">-</span>
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{match.match_results?.team2_score ?? '-'}</span>
          </div>
        )}

        <div className="flex-1 min-w-0 text-right">
          <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm leading-tight">
            {getTeamDisplay(effectiveTeam2, match.team2_slot)}
          </p>
          {!team2Resolved && isSlotReference(match.team2_slot) && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Slot pendiente
            </p>
          )}
        </div>
      </div>

      {/* Selector de ganador para eliminatorias */}
      {isElimination && editing && bothTeamsResolved && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg border dark:border-zinc-600">
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
            Ingresa el marcador de los 90 minutos. Si hay empate, selecciona manualmente el equipo clasificado.
          </p>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
            Equipo que avanza (obligatorio solo si hay empate):
          </label>
          <select
            value={winnerTeamId || ''}
            onChange={(e) => setWinnerTeamId(e.target.value || null)}
            className="w-full px-3 py-2 border dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            disabled={saving}
          >
            <option value="">Auto (inferido del marcador)</option>
            {effectiveTeam1 && (
              <option value={effectiveTeam1.id}>{getTeamDisplayName(effectiveTeam1)}</option>
            )}
            {effectiveTeam2 && (
              <option value={effectiveTeam2.id}>{getTeamDisplayName(effectiveTeam2)}</option>
            )}
          </select>
        </div>
      )}

      {isElimination && !editing && match.match_results?.winner && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border dark:border-green-800">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Avanza: {getTeamDisplayName(match.match_results.winner)}
          </p>
        </div>
      )}

      {!bothTeamsResolved && isElimination && (
        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-sm text-orange-800 dark:text-orange-300">
            ⚠️ Este partido tiene slots pendientes de resolución. Los equipos aún no pueden determinarse.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4 pt-4 border-t dark:border-zinc-700">
        {editing ? (
          <>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (isElimination && !bothTeamsResolved)}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-medium transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            disabled={saving}
            className="px-6 py-2 bg-zinc-800 dark:bg-zinc-700 text-white rounded-md hover:bg-zinc-700 dark:hover:bg-zinc-600 disabled:opacity-50 shadow-sm font-medium transition-colors"
          >
            {hasResult ? 'Editar Resultado' : 'Ingresar Resultado'}
          </button>
        )}
      </div>
    </div>
  );
}
