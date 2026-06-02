/**
 * src/components/admin/TiebreaksClient.tsx
 *
 * Client component for manual tiebreak resolution.
 * Uses groupStandings and bestThirds engines to detect ties.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { calculateTiebreakData } from '@/lib/tournament/tiebreaksHelper';
import { saveManualTiebreak } from '@/server/actions/saveManualTiebreak';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';
import { GROUP_ORDER } from '@/lib/tournament/display';

interface TeamData {
  id: string;
  name: string;
  display_name_es?: string | null;
  code: string;
  group_code: string | null;
}

interface MatchData {
  id: string;
  team1_id: string | null;
  team2_id: string | null;
  group_code: string | null;
}

interface MatchResultData {
  match_id: string;
  team1_score: number;
  team2_score: number;
}

interface ManualTiebreakData {
  id: string;
  type: 'group_tiebreak' | 'best_thirds';
  reference: string;
  ordered_team_ids: string[];
  resolved_by: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  teams: TeamData[];
  groupMatches: MatchData[];
  matchResults: MatchResultData[];
  manualTiebreaks: ManualTiebreakData[];
}

export default function TiebreaksClient({
  teams,
  groupMatches,
  matchResults,
  manualTiebreaks,
}: Props) {
  const router = useRouter();
  const [groupTiebreaks, setGroupTiebreaks] = useState<Record<string, any>>({});
  const [bestThirdsTiebreak, setBestThirdsTiebreak] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    calculateTiebreaks();
  }, [teams, groupMatches, matchResults, manualTiebreaks]);

  function calculateTiebreaks() {
    setLoading(true);

    const result = calculateTiebreakData(teams, groupMatches, matchResults, manualTiebreaks);

    setGroupTiebreaks(result.groupTiebreaks);
    setBestThirdsTiebreak(result.bestThirdsTiebreak);

    setLoading(false);
  }

  async function saveGroupTiebreak(groupCode: string, orderedTeamIds: string[]) {
    setSaving(`group_${groupCode}`);
    try {
      const result = await saveManualTiebreak({
        type: 'group_tiebreak',
        reference: groupCode,
        orderedTeamIds,
      });

      if (!result.success) {
        throw new Error(result.error || 'Error al guardar el desempate');
      }

      if (result.recalculationError) {
        alert(
          `Desempate guardado, pero hubo un error al recalcular puntajes: ${result.recalculationError}`
        );
      }

      router.refresh();
    } catch (error) {
      console.error('Error saving group tiebreak:', error);
      alert(error instanceof Error ? error.message : 'Error al guardar el desempate');
    } finally {
      setSaving(null);
    }
  }

  async function saveBestThirdsTiebreak(orderedTeamIds: string[]) {
    setSaving('best_thirds');
    try {
      const result = await saveManualTiebreak({
        type: 'best_thirds',
        reference: 'best_thirds',
        orderedTeamIds,
      });

      if (!result.success) {
        throw new Error(result.error || 'Error al guardar el desempate');
      }

      if (result.recalculationError) {
        alert(
          `Desempate guardado, pero hubo un error al recalcular puntajes: ${result.recalculationError}`
        );
      }

      router.refresh();
    } catch (error) {
      console.error('Error saving best thirds tiebreak:', error);
      alert(error instanceof Error ? error.message : 'Error al guardar el desempate');
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Calculando desempates...</div>
      </div>
    );
  }

  const hasGroupTiebreaks = Object.keys(groupTiebreaks).length > 0;
  const hasBestThirdsTiebreak = bestThirdsTiebreak !== null;

  if (!hasGroupTiebreaks && !hasBestThirdsTiebreak) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-green-800 mb-2">Sin desempates pendientes</h2>
        <p className="text-green-700">
          No hay desempates que requieran resolución manual en este momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Group Tiebreaks */}
      {hasGroupTiebreaks && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Desempates dentro de grupos</h2>
          <div className="space-y-6">
            {GROUP_ORDER
              .filter(groupCode => groupTiebreaks[groupCode])
              .map(groupCode => (
                <GroupTiebreakCard
                  key={groupCode}
                  groupCode={groupCode}
                  tiedTeams={groupTiebreaks[groupCode].tiedTeams}
                  fullStandings={groupTiebreaks[groupCode].fullStandings}
                  existingResolution={groupTiebreaks[groupCode].existingResolution}
                  resolved={groupTiebreaks[groupCode].resolved}
                  onSave={(order) => saveGroupTiebreak(groupCode, order)}
                  saving={saving === `group_${groupCode}`}
                />
              ))}
          </div>
        </div>
      )}

      {/* Best Thirds Tiebreak */}
      {hasBestThirdsTiebreak && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Desempates entre mejores terceros</h2>
          <BestThirdsTiebreakCard
            tiedTeams={bestThirdsTiebreak.tiedTeams}
            existingResolution={bestThirdsTiebreak.existingResolution}
            resolved={bestThirdsTiebreak.resolved}
            onSave={(order) => saveBestThirdsTiebreak(order)}
            saving={saving === 'best_thirds'}
          />
        </div>
      )}
    </div>
  );
}

function GroupTiebreakCard({
  groupCode,
  tiedTeams,
  fullStandings,
  existingResolution,
  resolved,
  onSave,
  saving,
}: {
  groupCode: string;
  tiedTeams: any[];
  fullStandings: any[];
  existingResolution: string[] | null;
  resolved: boolean;
  onSave: (order: string[]) => void;
  saving: boolean;
}) {
  const [orderedTeams, setOrderedTeams] = useState<string[]>(
    existingResolution || tiedTeams.map((t) => t.id)
  );

  const moveTeam = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderedTeams];
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setOrderedTeams(newOrder);
  };

  // Calculate the position range for the tie header
  const positions = orderedTeams.map((teamId) => {
    const team = tiedTeams.find((t) => t.id === teamId);
    return team?.realPosition || 0;
  });
  const minPosition = Math.min(...positions);
  const maxPosition = Math.max(...positions);

  return (
    <div className={`border rounded-lg p-6 ${resolved ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Grupo {groupCode}</h3>
        {resolved && (
          <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
            Resuelto
          </span>
        )}
      </div>

      <div className="mb-4 text-sm text-gray-600">
        Empate por posiciones {minPosition}–{maxPosition}
      </div>

      <div className="space-y-3">
        {orderedTeams.map((teamId, index) => {
          const team = tiedTeams.find((t) => t.id === teamId);
          if (!team) return null;

          // Display position within the tied block (startPosition + index)
          const displayPosition = minPosition + index;

          return (
            <div
              key={team.id}
              className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-gray-400 w-8">{displayPosition}</span>
                <div>
                  <div className="font-semibold">{getTeamDisplayName(team)}</div>
                  <div className="text-sm text-gray-600">
                    PTS: {team.points} | DG: {team.goalDifference} | GF: {team.goalsFor}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => moveTeam(index, 'up')}
                  disabled={index === 0}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveTeam(index, 'down')}
                  disabled={index === orderedTeams.length - 1}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded"
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => onSave(orderedTeams)}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : resolved ? 'Actualizar resolución' : 'Guardar resolución'}
        </button>
      </div>
    </div>
  );
}

function BestThirdsTiebreakCard({
  tiedTeams,
  existingResolution,
  resolved,
  onSave,
  saving,
}: {
  tiedTeams: any[];
  existingResolution: string[] | null;
  resolved: boolean;
  onSave: (order: string[]) => void;
  saving: boolean;
}) {
  const [orderedTeams, setOrderedTeams] = useState<string[]>(
    existingResolution || tiedTeams.map((t) => t.id)
  );

  const moveTeam = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderedTeams];
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setOrderedTeams(newOrder);
  };

  const hasCriticalTie = tiedTeams.some((t) => t.isCritical);

  return (
    <div className={`border rounded-lg p-6 ${resolved ? 'bg-green-50 border-green-200' : hasCriticalTie ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Mejores terceros</h3>
        {resolved ? (
          <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
            Resuelto
          </span>
        ) : hasCriticalTie ? (
          <span className="bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full">
            Crítico - Afecta corte 8/9
          </span>
        ) : null}
      </div>

      {hasCriticalTie && !resolved && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
          <p className="text-red-800 text-sm">
            ⚠️ Este desempate afecta qué equipos clasifican a octavos (corte entre posición 8 y 9).
          </p>
        </div>
      )}

      <div className="space-y-3">
        {orderedTeams.map((teamId, index) => {
          const team = tiedTeams.find((t) => t.id === teamId);
          if (!team) return null;

          return (
            <div
              key={team.id}
              className={`flex items-center justify-between rounded-lg p-4 ${team.isCritical ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}
            >
              <div className="flex items-center gap-4">
                <span className={`text-2xl font-bold w-8 ${team.isCritical ? 'text-red-600' : 'text-gray-400'}`}>
                  {team.position}
                </span>
                <div>
                  <div className="font-semibold">{getTeamDisplayName(team)}</div>
                  <div className="text-sm text-gray-600">
                    PTS: {team.points} | DG: {team.goalDifference} | GF: {team.goalsFor}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => moveTeam(index, 'up')}
                  disabled={index === 0}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveTeam(index, 'down')}
                  disabled={index === orderedTeams.length - 1}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded"
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => onSave(orderedTeams)}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : resolved ? 'Actualizar resolución' : 'Guardar resolución'}
        </button>
      </div>
    </div>
  );
}
