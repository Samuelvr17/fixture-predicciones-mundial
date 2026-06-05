'use client';

import { useState } from 'react';
import ScoreBreakdownDetails from './ScoreBreakdownDetails';

interface ScoreBreakdown {
    id: string;
    exact_scores_group_stage: number;
    correct_results_group_stage: number;
    exact_scores_knockout: number;
    advances_points: number;
    third_place_points: number;
    champion_points: number;
    top_scorer_points: number;
    best_goalkeeper_points: number;
    total_points: number;
    last_calculated_at: string;
    details: any;
}

interface Profile {
    id: string;
    username: string;
    avatar_url: string | null;
}

interface Member {
    id: string;
    user_id: string;
    role: 'member' | 'leader';
    joined_at: string;
    profiles: Profile;
    score_breakdowns: ScoreBreakdown | null;
}

interface LeaderboardTableProps {
    members: Member[];
    currentUserId: string;
}

export default function LeaderboardTable({ members, currentUserId }: LeaderboardTableProps) {
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);

    // Process members to add ranking and handle missing score breakdowns
    const processedMembers = members
        .map((member) => ({
            ...member,
            score_breakdowns: member.score_breakdowns || {
                id: '',
                exact_scores_group_stage: 0,
                correct_results_group_stage: 0,
                exact_scores_knockout: 0,
                advances_points: 0,
                third_place_points: 0,
                champion_points: 0,
                top_scorer_points: 0,
                best_goalkeeper_points: 0,
                total_points: 0,
                last_calculated_at: '',
                details: null,
            },
        }))
        .sort((a, b) => {
            // Sort by total_points descending, then username ascending
            if (b.score_breakdowns.total_points !== a.score_breakdowns.total_points) {
                return b.score_breakdowns.total_points - a.score_breakdowns.total_points;
            }
            return a.profiles.username.localeCompare(b.profiles.username);
        })
        .map((member, index) => ({
            ...member,
            rank: index + 1,
        }));

    // Check if any member has score breakdowns
    const hasAnyScores = members.some((m) => m.score_breakdowns !== null);

    if (!hasAnyScores) {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-8 text-center">
                <p className="text-zinc-600 dark:text-zinc-400 text-lg">
                    Aún no hay puntajes calculados.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-zinc-50 dark:bg-zinc-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Posición
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Usuario
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Rol
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Total
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Exactos Grupos
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Resultados Grupos
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Exactos Eliminatorias
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Avances
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Campeón
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Tercer Puesto
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Goleador
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Mejor arquero
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Última Actualización
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Detalles
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
                            {processedMembers.map((member) => {
                                const isCurrentUser = member.user_id === currentUserId;
                                const roleLabel = member.role === 'leader' ? 'Líder' : 'Miembro';
                                const hasDetails = member.score_breakdowns.details && 
                                    Object.keys(member.score_breakdowns.details).length > 0;

                                return (
                                    <tr
                                        key={member.id}
                                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                                            isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                        }`}
                                    >
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                                member.rank === 1 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                member.rank === 2 ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                                                member.rank === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                                'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
                                            }`}>
                                                {member.rank}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                                                        {member.profiles.avatar_url ? (
                                                            <img
                                                                src={member.profiles.avatar_url}
                                                                alt={member.profiles.username || 'Usuario'}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                                                                {member.profiles.username?.[0]?.toUpperCase() || 'U'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                        {member.profiles.username || 'Usuario sin nombre'}
                                                        {isCurrentUser && (
                                                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                                                (Tú)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {roleLabel}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                                {member.score_breakdowns.total_points}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {member.score_breakdowns.exact_scores_group_stage}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {member.score_breakdowns.correct_results_group_stage}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {member.score_breakdowns.exact_scores_knockout}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {member.score_breakdowns.advances_points}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {member.score_breakdowns.champion_points}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {member.score_breakdowns.third_place_points}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {member.score_breakdowns.top_scorer_points}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {member.score_breakdowns.best_goalkeeper_points}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-left">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {member.score_breakdowns.last_calculated_at
                                                    ? new Date(member.score_breakdowns.last_calculated_at).toLocaleString('es-ES', {
                                                        dateStyle: 'short',
                                                        timeStyle: 'short',
                                                    })
                                                    : '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-left">
                                            {hasDetails ? (
                                                <button
                                                    onClick={() => setSelectedMember(member)}
                                                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                                >
                                                    Ver detalles
                                                </button>
                                            ) : (
                                                <span className="text-sm text-zinc-400 dark:text-zinc-600">
                                                    -
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedMember && (
                <ScoreBreakdownDetails
                    member={selectedMember}
                    onClose={() => setSelectedMember(null)}
                />
            )}
        </>
    );
}
