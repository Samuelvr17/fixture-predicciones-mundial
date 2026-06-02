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
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          {match.match_number && (
            <span className="text-sm text-gray-500 mr-2">#{match.match_number}</span>
          )}
          {match.group_code && (
            <span className="text-sm font-semibold text-gray-700 mr-2">Grupo {match.group_code}</span>
          )}
          <span className="text-sm text-gray-500">
            {match.match_date} - {match.match_time} <span className="text-gray-400">(Hora Colombia)</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasResult && !editing && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
              Jugado
            </span>
          )}
          {!hasResult && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
              Pendiente
            </span>
          )}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-sm text-gray-600">{match.venue}</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="font-medium">
            {getTeamDisplay(effectiveTeam1, match.team1_slot)}
          </p>
          {!team1Resolved && isSlotReference(match.team1_slot) && (
            <p className="text-xs text-orange-600 mt-1">
              Slot pendiente de resolución
            </p>
          )}
        </div>

        {editing ? (
          <div className="flex items-center gap-2 mx-4">
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
              className="w-16 px-2 py-1 border rounded text-center"
              disabled={saving}
            />
            <span className="text-gray-400">-</span>
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
              className="w-16 px-2 py-1 border rounded text-center"
              disabled={saving}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 mx-4">
            <span className="text-2xl font-bold">{match.match_results?.team1_score ?? '-'}</span>
            <span className="text-gray-400">-</span>
            <span className="text-2xl font-bold">{match.match_results?.team2_score ?? '-'}</span>
          </div>
        )}

        <div className="flex-1 text-right">
          <p className="font-medium">
            {getTeamDisplay(effectiveTeam2, match.team2_slot)}
          </p>
          {!team2Resolved && isSlotReference(match.team2_slot) && (
            <p className="text-xs text-orange-600 mt-1">
              Slot pendiente de resolución
            </p>
          )}
        </div>
      </div>

      {/* Selector de ganador para eliminatorias */}
      {isElimination && editing && bothTeamsResolved && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-amber-700 mb-2">
            Ingresa el marcador de los 90 minutos. Si hay empate, selecciona manualmente el equipo clasificado.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Equipo que avanza (obligatorio solo si hay empate):
          </label>
          <select
            value={winnerTeamId || ''}
            onChange={(e) => setWinnerTeamId(e.target.value || null)}
            className="w-full px-3 py-2 border rounded"
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
        <div className="mb-4 p-3 bg-green-50 rounded">
          <p className="text-sm font-medium text-green-800">
            Avanza: {getTeamDisplayName(match.match_results.winner)}
          </p>
        </div>
      )}

      {!bothTeamsResolved && isElimination && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded">
          <p className="text-sm text-orange-800">
            ⚠️ Este partido tiene slots pendientes de resolución. Los equipos aún no pueden determinarse.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (isElimination && !bothTeamsResolved)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            disabled={saving}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {hasResult ? 'Editar Resultado' : 'Ingresar Resultado'}
          </button>
        )}
      </div>
    </div>
  );
}
