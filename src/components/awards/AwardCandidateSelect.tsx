'use client';

import { useMemo, useState } from 'react';
import type { Database } from '@/types/database.types';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';

type Team = Database['public']['Tables']['teams']['Row'];
type AwardCategory = 'top_scorer' | 'best_goalkeeper';

export type AwardCandidate = Database['public']['Tables']['award_player_candidates']['Row'] & {
  team?: Pick<Team, 'id' | 'name' | 'display_name_es' | 'code'> | null;
};

interface AwardCandidateSelectProps {
  candidates: AwardCandidate[];
  teams: Team[];
  value: string | null;
  onChange: (candidateId: string | null, candidate?: AwardCandidate | null) => void;
  awardCategory: AwardCategory;
  placeholder: string;
  label: string;
  helpText: string;
  allowOther?: boolean;
  otherName?: string;
  otherTeamId?: string | null;
  onOtherChange?: (value: { name: string; teamId: string | null }) => void;
  disabled?: boolean;
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getCandidateTeamLabel(candidate: AwardCandidate) {
  if (candidate.team) return getTeamDisplayName(candidate.team as Team);
  return candidate.team_code || 'Selección pendiente';
}

export default function AwardCandidateSelect({
  candidates,
  teams,
  value,
  onChange,
  awardCategory,
  placeholder,
  label,
  helpText,
  allowOther = false,
  otherName = '',
  otherTeamId = null,
  onOtherChange,
  disabled = false,
}: AwardCandidateSelectProps) {
  const [query, setQuery] = useState('');
  const [isOther, setIsOther] = useState(!value && !!otherName);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === value) ?? null,
    [candidates, value]
  );

  const filteredCandidates = useMemo(() => {
    const categoryCandidates = candidates.filter((candidate) =>
      candidate.is_active && candidate.award_categories.includes(awardCategory)
    );
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return categoryCandidates.slice(0, 30);

    return categoryCandidates
      .filter((candidate) => {
        const searchable = [
          candidate.full_name,
          candidate.display_name,
          candidate.team_code,
          getCandidateTeamLabel(candidate),
          ...candidate.aliases,
        ]
          .filter(Boolean)
          .join(' ');
        return normalizeSearch(searchable).includes(normalizedQuery);
      })
      .slice(0, 30);
  }, [awardCategory, candidates, query]);

  const selectCandidate = (candidate: AwardCandidate) => {
    setIsOther(false);
    setQuery('');
    onOtherChange?.({ name: '', teamId: null });
    onChange(candidate.id, candidate);
  };

  const selectOther = () => {
    setIsOther(true);
    setQuery('');
    onChange(null, null);
  };

  const clearSelection = () => {
    setIsOther(false);
    setQuery('');
    onOtherChange?.({ name: '', teamId: null });
    onChange(null, null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="block text-sm font-medium">{label}</label>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{helpText}</p>
        </div>
        {(value || isOther || otherName) && !disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300"
          >
            Limpiar
          </button>
        )}
      </div>

      {selectedCandidate && !isOther && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/30">
          <span className="font-semibold">{selectedCandidate.display_name}</span>
          <span className="text-zinc-500 dark:text-zinc-400"> · {getCandidateTeamLabel(selectedCandidate)}</span>
        </div>
      )}

      {!isOther && (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-800"
          />
          {(query || !selectedCandidate) && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              {filteredCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectCandidate(candidate)}
                  className="flex w-full items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium">{candidate.display_name}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{getCandidateTeamLabel(candidate)}</span>
                </button>
              ))}
              {filteredCandidates.length === 0 && (
                <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Sin resultados</div>
              )}
            </div>
          )}
        </>
      )}

      {allowOther && !disabled && (
        <button
          type="button"
          onClick={selectOther}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300"
        >
          Otro jugador no aparece en la lista
        </button>
      )}

      {allowOther && isOther && (
        <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50 sm:grid-cols-2">
          <input
            type="text"
            value={otherName}
            onChange={(event) => onOtherChange?.({ name: event.target.value, teamId: otherTeamId })}
            disabled={disabled}
            placeholder="Nombre completo del jugador"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <select
            value={otherTeamId ?? ''}
            onChange={(event) => onOtherChange?.({ name: otherName, teamId: event.target.value || null })}
            disabled={disabled}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Selección (opcional)</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{getTeamDisplayName(team)}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
