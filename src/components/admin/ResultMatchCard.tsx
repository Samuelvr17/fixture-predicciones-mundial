/**
 * src/components/admin/ResultMatchCard.tsx
 *
 * Card reutilizable para mostrar y editar resultados de partidos.
 */

'use client';

import { useState } from 'react';

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

interface ResultMatchCardProps {
  match: Match;
  teams: Team[];
  isElimination: boolean;
  onSave: (matchId: string, team1Score: number, team2Score: number, winnerTeamId: string | null, isElimination: boolean, team1Id: string | null, team2Id: string | null) => void;
  saving: boolean;
}

export default function ResultMatchCard({ match, teams, isElimination, onSave, saving }: ResultMatchCardProps) {
  const [editing, setEditing] = useState(false);
  const [team1Score, setTeam1Score] = useState(match.match_results?.team1_score ?? 0);
  const [team2Score, setTeam2Score] = useState(match.match_results?.team2_score ?? 0);
  const [winnerTeamId, setWinnerTeamId] = useState(match.match_results?.winner_team_id ?? null);

  const hasResult = !!match.match_results;
  const team1Resolved = !!match.team1;
  const team2Resolved = !!match.team2;
  const bothTeamsResolved = team1Resolved && team2Resolved;

  const handleSave = () => {
    onSave(match.id, team1Score, team2Score, winnerTeamId, isElimination, match.team1_id, match.team2_id);
    setEditing(false);
  };

  const handleCancel = () => {
    setTeam1Score(match.match_results?.team1_score ?? 0);
    setTeam2Score(match.match_results?.team2_score ?? 0);
    setWinnerTeamId(match.match_results?.winner_team_id ?? null);
    setEditing(false);
  };

  const getTeamDisplay = (team: Team | null, slot: string) => {
    if (team) {
      return `${team.name} (${team.code})`;
    }
    return `Slot: ${slot} (pendiente)`;
  };

  const isSlotReference = (slot: string): boolean => {
    // Check if slot is a reference like "1A", "2B", "W74", "L101", etc.
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
            {match.match_date} - {match.match_time}
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
            {getTeamDisplay(match.team1, match.team1_slot)}
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
              type="number"
              min="0"
              value={team1Score}
              onChange={(e) => setTeam1Score(parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-1 border rounded text-center"
              disabled={saving}
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              min="0"
              value={team2Score}
              onChange={(e) => setTeam2Score(parseInt(e.target.value) || 0)}
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
            {getTeamDisplay(match.team2, match.team2_slot)}
          </p>
          {!team2Resolved && isSlotReference(match.team2_slot) && (
            <p className="text-xs text-orange-600 mt-1">
              Slot pendiente de resolución
            </p>
          )}
        </div>
      </div>

      {isElimination && editing && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Equipo que avanza:
          </label>
          <select
            value={winnerTeamId || ''}
            onChange={(e) => setWinnerTeamId(e.target.value || null)}
            className="w-full px-3 py-2 border rounded"
            disabled={saving}
          >
            <option value="">Seleccionar equipo...</option>
            {match.team1 && (
              <option value={match.team1.id}>{match.team1.name}</option>
            )}
            {match.team2 && (
              <option value={match.team2.id}>{match.team2.name}</option>
            )}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            El equipo que avanza puede diferir del ganador de los 90 minutos (tiempo extra o penales)
          </p>
        </div>
      )}

      {isElimination && !editing && match.match_results?.winner && (
        <div className="mb-4 p-3 bg-green-50 rounded">
          <p className="text-sm font-medium text-green-800">
            Avanza: {match.match_results.winner.name}
          </p>
        </div>
      )}

      {!bothTeamsResolved && isElimination && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded">
          <p className="text-sm text-orange-800">
            ⚠️ Este partido tiene slots pendientes de resolución. No se puede guardar el resultado hasta que ambos equipos estén definidos.
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
