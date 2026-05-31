'use client';

import { useState, useMemo } from 'react';
import MatchCard from './MatchCard';
import type { MatchWithNormalizedResult } from '@/app/groups/[groupId]/matches/page';
import { compareMatchDateTime, formatMatchDateLong } from '@/lib/utils/matchDate';

const ROUND_ORDER = ['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final'] as const;

const ROUND_LABELS: Record<string, string> = {
    group: 'Fase de Grupos',
    round_of_32: 'Dieciseisavos',
    round_of_16: 'Octavos',
    quarter_final: 'Cuartos de final',
    semi_final: 'Semifinales',
    third_place: 'Tercer puesto',
    final: 'Final'
};

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

interface MatchesCalendarClientProps {
    matches: MatchWithNormalizedResult[];
}

export default function MatchesCalendarClient({ matches }: MatchesCalendarClientProps) {
    const [selectedPhase, setSelectedPhase] = useState<string>('all');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');

    // Normalize group_code from "Group A" to "A" if needed
    const normalizeGroupCode = (groupCode: string | null): string | null => {
        if (!groupCode) return null;
        if (groupCode.startsWith('Group ')) {
            return groupCode.replace('Group ', '');
        }
        return groupCode;
    };

    // Filter and sort matches
    const filteredMatches = useMemo(() => {
        let filtered = matches;

        // Filter by phase
        if (selectedPhase !== 'all') {
            filtered = filtered.filter(m => m.round === selectedPhase);
        }

        // Filter by group (only for group stage)
        if (selectedGroup !== 'all' && selectedPhase === 'group') {
            filtered = filtered.filter(m => normalizeGroupCode(m.group_code) === selectedGroup);
        }

        // Filter by status
        if (selectedStatus !== 'all') {
            if (selectedStatus === 'played') {
                filtered = filtered.filter(m => m.result !== null);
            } else if (selectedStatus === 'pending') {
                filtered = filtered.filter(m => m.result === null);
            }
        }

        // Sort by phase, then date, then time
        const sorted = filtered.sort((a, b) => {
            const roundOrderA = ROUND_ORDER.indexOf(a.round);
            const roundOrderB = ROUND_ORDER.indexOf(b.round);
            if (roundOrderA !== roundOrderB) return roundOrderA - roundOrderB;

            return compareMatchDateTime(a.match_date, a.match_time, b.match_date, b.match_time);
        });

        return sorted;
    }, [matches, selectedPhase, selectedGroup, selectedStatus]);

    // Group matches by phase and date
    const groupedMatches = useMemo(() => {
        const groups: Record<string, Record<string, MatchWithNormalizedResult[]>> = {};

        filteredMatches.forEach(match => {
            if (!groups[match.round]) {
                groups[match.round] = {};
            }
            if (!groups[match.round][match.match_date]) {
                groups[match.round][match.match_date] = [];
            }
            groups[match.round][match.match_date].push(match);
        });

        return groups;
    }, [filteredMatches]);

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Phase Filter */}
                    <div>
                        <label htmlFor="phase-filter" className="block text-sm font-medium mb-2">
                            Fase
                        </label>
                        <select
                            id="phase-filter"
                            value={selectedPhase}
                            onChange={(e) => {
                                setSelectedPhase(e.target.value);
                                setSelectedGroup('all'); // Reset group filter when phase changes
                            }}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        >
                            <option value="all">Todas las fases</option>
                            {ROUND_ORDER.map(round => (
                                <option key={round} value={round}>
                                    {ROUND_LABELS[round]}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Group Filter (only for group stage) */}
                    {selectedPhase === 'group' && (
                        <div>
                            <label htmlFor="group-filter" className="block text-sm font-medium mb-2">
                                Grupo
                            </label>
                            <select
                                id="group-filter"
                                value={selectedGroup}
                                onChange={(e) => setSelectedGroup(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            >
                                <option value="all">Todos los grupos</option>
                                {GROUPS.map(group => (
                                    <option key={group} value={group}>
                                        Grupo {group}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Status Filter */}
                    <div>
                        <label htmlFor="status-filter" className="block text-sm font-medium mb-2">
                            Estado
                        </label>
                        <select
                            id="status-filter"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        >
                            <option value="all">Todos</option>
                            <option value="played">Jugados</option>
                            <option value="pending">Pendientes</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Matches Display */}
            {Object.entries(groupedMatches).length === 0 ? (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    No hay partidos que coincidan con los filtros seleccionados.
                </div>
            ) : (
                Object.entries(groupedMatches).map(([round, dates]) => (
                    <div key={round} className="space-y-4">
                        <h2 className="text-2xl font-bold tracking-tight">
                            {ROUND_LABELS[round]}
                        </h2>
                        {Object.entries(dates).map(([date, matchesByDate]) => (
                            <div key={date} className="space-y-3">
                                <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                                    {formatMatchDateLong(date)}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {matchesByDate.map(match => (
                                        <MatchCard key={match.id} match={match} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    );
}
