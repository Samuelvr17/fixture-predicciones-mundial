/**
 * src/components/admin/TiebreaksClient.tsx
 *
 * Client component for manual tiebreak resolution.
 * Uses groupStandings and bestThirds engines to detect ties.
 */

'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';
import { calculateGroupStandings, type Team, type Match, type MatchResult } from '@/lib/tournament/groupStandings';
import { calculateBestThirds, type ManualTiebreak as BestThirdsManualTiebreak } from '@/lib/tournament/bestThirds';

interface TeamData {
  id: string;
  name: string;
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
  currentUserId: string;
}

export default function TiebreaksClient({
  teams,
  groupMatches,
  matchResults,
  manualTiebreaks,
  currentUserId,
}: Props) {
  const [supabase] = useState(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [groupTiebreaks, setGroupTiebreaks] = useState<Record<string, any>>({});
  const [bestThirdsTiebreak, setBestThirdsTiebreak] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    calculateTiebreaks();
  }, [teams, groupMatches, matchResults, manualTiebreaks]);

  function calculateTiebreaks() {
    setLoading(true);

    // Convert data to engine format
    const teamMap = new Map<string, Team>();
    for (const team of teams) {
      if (team.group_code) {
        teamMap.set(team.id, {
          id: team.id,
          name: team.name,
          code: team.code,
          group_code: team.group_code,
        });
      }
    }

    const matchMap = new Map<string, Match>();
    for (const match of groupMatches) {
      if (match.team1_id && match.team2_id && match.group_code) {
        matchMap.set(match.id, {
          id: match.id,
          team1_id: match.team1_id,
          team2_id: match.team2_id,
          group_code: match.group_code,
          round: 'group',
        });
      }
    }

    const resultMap = new Map<string, MatchResult>();
    for (const result of matchResults) {
      resultMap.set(result.match_id, {
        match_id: result.match_id,
        team1_score: result.team1_score,
        team2_score: result.team2_score,
      });
    }

    // Calculate group standings
    const allTeams = Array.from(teamMap.values());
    const allMatches = Array.from(matchMap.values());
    const allResults = Array.from(resultMap.values());

    const groupStandingsOutput = calculateGroupStandings(allTeams, allMatches, allResults);

    // Find groups requiring manual tiebreak
    const groupTiebreakData: Record<string, any> = {};
    for (const [groupCode, standings] of Object.entries(groupStandingsOutput.standings)) {
      if (standings.requiresManualTiebreak && standings.tiedTeams.length > 0) {
        // Check if already resolved
        const existing = manualTiebreaks.find(
          (t) => t.type === 'group_tiebreak' && t.reference === groupCode
        );

        const tiedTeamsData = standings.tiedTeams
          .map((teamId) => {
            const stats = standings.standings.find((s) => s.team_id === teamId);
            const team = teams.find((t) => t.id === teamId);
            if (!stats || !team) return null;
            return {
              id: team.id,
              name: team.name,
              code: team.code,
              points: stats.points,
              goalDifference: stats.goalDifference,
              goalsFor: stats.goalsFor,
            };
          })
          .filter(Boolean);

        groupTiebreakData[groupCode] = {
          groupCode,
          tiedTeams: tiedTeamsData,
          existingResolution: existing ? existing.ordered_team_ids : null,
          resolved: !!existing,
        };
      }
    }

    setGroupTiebreaks(groupTiebreakData);

    // Calculate best thirds
    if (groupStandingsOutput.thirdPlaceTeams.length === 12) {
      const existingBestThirds = manualTiebreaks.find(
        (t) => t.type === 'best_thirds' && t.reference === 'best_thirds'
      );

      const manualTiebreak: BestThirdsManualTiebreak | undefined = existingBestThirds
        ? {
            type: 'best_thirds',
            reference: 'best_thirds',
            ordered_team_ids: existingBestThirds.ordered_team_ids,
          }
        : undefined;

      const bestThirdsOutput = calculateBestThirds(
        groupStandingsOutput.thirdPlaceTeams,
        manualTiebreak
      );

      if (bestThirdsOutput.requiresManualTiebreak) {
        const tiedAtCutData = bestThirdsOutput.tiedAtCut
          .map((teamId) => {
            const stats = bestThirdsOutput.orderedThirds.find((s) => s.team_id === teamId);
            const team = teams.find((t) => t.id === teamId);
            if (!stats || !team) return null;
            const position = bestThirdsOutput.orderedThirds.findIndex((s) => s.team_id === teamId) + 1;
            return {
              id: team.id,
              name: team.name,
              code: team.code,
              points: stats.points,
              goalDifference: stats.goalDifference,
              goalsFor: stats.goalsFor,
              position,
              isCritical: position <= 8,
            };
          })
          .filter(Boolean);

        setBestThirdsTiebreak({
          tiedTeams: tiedAtCutData,
          existingResolution: existingBestThirds ? existingBestThirds.ordered_team_ids : null,
          resolved: !!existingBestThirds,
        });
      } else {
        setBestThirdsTiebreak(null);
      }
    } else {
      setBestThirdsTiebreak(null);
    }

    setLoading(false);
  }

  async function saveGroupTiebreak(groupCode: string, orderedTeamIds: string[]) {
    setSaving(`group_${groupCode}`);
    try {
      const existing = manualTiebreaks.find(
        (t) => t.type === 'group_tiebreak' && t.reference === groupCode
      );

      if (existing) {
        const { error } = await supabase
          .from('manual_tiebreaks')
          .update({
            ordered_team_ids: orderedTeamIds,
            resolved_by: currentUserId,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('manual_tiebreaks').insert({
          type: 'group_tiebreak',
          reference: groupCode,
          ordered_team_ids: orderedTeamIds,
          resolved_by: currentUserId,
        });

        if (error) throw error;
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error saving group tiebreak:', error);
      alert('Error al guardar el desempate');
    } finally {
      setSaving(null);
    }
  }

  async function saveBestThirdsTiebreak(orderedTeamIds: string[]) {
    setSaving('best_thirds');
    try {
      const existing = manualTiebreaks.find(
        (t) => t.type === 'best_thirds' && t.reference === 'best_thirds'
      );

      if (existing) {
        const { error } = await supabase
          .from('manual_tiebreaks')
          .update({
            ordered_team_ids: orderedTeamIds,
            resolved_by: currentUserId,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('manual_tiebreaks').insert({
          type: 'best_thirds',
          reference: 'best_thirds',
          ordered_team_ids: orderedTeamIds,
          resolved_by: currentUserId,
        });

        if (error) throw error;
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error saving best thirds tiebreak:', error);
      alert('Error al guardar el desempate');
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
            {Object.entries(groupTiebreaks).map(([groupCode, data]) => (
              <GroupTiebreakCard
                key={groupCode}
                groupCode={groupCode}
                tiedTeams={data.tiedTeams}
                existingResolution={data.existingResolution}
                resolved={data.resolved}
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
  existingResolution,
  resolved,
  onSave,
  saving,
}: {
  groupCode: string;
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

      <div className="space-y-3">
        {orderedTeams.map((teamId, index) => {
          const team = tiedTeams.find((t) => t.id === teamId);
          if (!team) return null;

          return (
            <div
              key={team.id}
              className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-gray-400 w-8">{index + 1}</span>
                <div>
                  <div className="font-semibold">{team.name}</div>
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
                  <div className="font-semibold">{team.name}</div>
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
