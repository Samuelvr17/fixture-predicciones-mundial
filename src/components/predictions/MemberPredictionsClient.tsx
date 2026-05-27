'use client';

import { useMemo } from 'react';
import type { Database } from '@/types/database.types';
import { compareMatchDateTime, formatMatchDateLong } from '@/lib/utils/matchDate';

type MatchWithTeam = Database['public']['Tables']['matches']['Row'] & {
    team1: Database['public']['Tables']['teams']['Row'] | null;
    team2: Database['public']['Tables']['teams']['Row'] | null;
};

type Prediction = Database['public']['Tables']['predictions_scores']['Row'];
type AdvancePrediction = Database['public']['Tables']['predictions_advances']['Row'];
type SpecialPrediction = Database['public']['Tables']['predictions_specials']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

interface MemberPredictionsClientProps {
    matches: MatchWithTeam[];
    predictionsMap: Map<string, Prediction>;
    groupId: string;
    teams: Team[];
    advancesMap: Map<string, AdvancePrediction>;
    specialPrediction: SpecialPrediction | null;
    memberName: string;
    isOwnPredictions: boolean;
}

const ROUND_ORDER = ['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final'] as const;

const ROUND_LABELS: Record<string, string> = {
    group: 'Fase de Grupos',
    round_of_32: 'Dieciseisavos',
    round_of_16: 'Octavos',
    quarter_final: 'Cuartos',
    semi_final: 'Semifinales',
    third_place: 'Tercer Puesto',
    final: 'Final'
};

const TOURNAMENT_ROUND_LABELS: Record<string, string> = {
    no_clasifica: 'No Clasifica',
    round_of_32: 'Dieciseisavos',
    round_of_16: 'Octavos',
    quarter_final: 'Cuartos',
    semi_final: 'Semifinales',
    final: 'Final',
    champion: 'Campeón'
};

export default function MemberPredictionsClient({
    matches,
    predictionsMap,
    groupId,
    teams,
    advancesMap,
    specialPrediction,
    memberName,
    isOwnPredictions
}: MemberPredictionsClientProps) {
    // Sort matches by phase, then date, then time
    const sortedMatches = useMemo(() => {
        return matches.sort((a, b) => {
            const roundOrderA = ROUND_ORDER.indexOf(a.round);
            const roundOrderB = ROUND_ORDER.indexOf(b.round);
            if (roundOrderA !== roundOrderB) return roundOrderA - roundOrderB;

            return compareMatchDateTime(a.match_date, a.match_time, b.match_date, b.match_time);
        });
    }, [matches]);

    // Group matches by phase and date
    const groupedMatches = useMemo(() => {
        const groups: Record<string, Record<string, MatchWithTeam[]>> = {};

        sortedMatches.forEach(match => {
            if (!groups[match.round]) {
                groups[match.round] = {};
            }
            if (!groups[match.round][match.match_date]) {
                groups[match.round][match.match_date] = [];
            }
            groups[match.round][match.match_date].push(match);
        });

        return groups;
    }, [sortedMatches]);

    // Check if member has any predictions
    const hasPredictions = predictionsMap.size > 0 || advancesMap.size > 0 || specialPrediction;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">
                        Predicciones de {memberName}
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        Vista de solo lectura
                    </p>
                </div>
                {isOwnPredictions && (
                    <a
                        href={`/groups/${groupId}/my-predictions`}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
                    >
                        Editar mis predicciones
                    </a>
                )}
            </div>

            {/* Empty State */}
            {!hasPredictions && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-12 text-center">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-semibold mb-2">Sin predicciones</h3>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        {memberName} aún no ha guardado ninguna predicción.
                    </p>
                </div>
            )}

            {hasPredictions && (
                <>
                    {/* Special Predictions */}
                    {(specialPrediction?.champion_team_id || specialPrediction?.third_place_team_id || specialPrediction?.top_scorer_name) && (
                        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 space-y-6">
                            <h2 className="text-2xl font-bold tracking-tight">Predicciones Especiales</h2>
                            
                            {/* Champion */}
                            {specialPrediction?.champion_team_id && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">🏆 Campeón</label>
                                    <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                                        {teams.find(t => t.id === specialPrediction.champion_team_id)?.name || 'N/A'}
                                    </div>
                                </div>
                            )}

                            {/* Third Place */}
                            {specialPrediction?.third_place_team_id && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">🥉 Tercer Puesto</label>
                                    <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                                        {teams.find(t => t.id === specialPrediction.third_place_team_id)?.name || 'N/A'}
                                    </div>
                                </div>
                            )}

                            {/* Top Scorer */}
                            {specialPrediction?.top_scorer_name && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">⚽ Goleador del Torneo</label>
                                    <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                                        {specialPrediction.top_scorer_name}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Team Advances */}
                    {advancesMap.size > 0 && (
                        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 space-y-6">
                            <h2 className="text-2xl font-bold tracking-tight">Avance Máximo por Selección</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {teams.map(team => {
                                    const advance = advancesMap.get(team.id);
                                    if (!advance) return null;

                                    return (
                                        <div
                                            key={team.id}
                                            className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 space-y-3"
                                        >
                                            {/* Team */}
                                            <div className="flex items-center space-x-2">
                                                {team.flag_url && (
                                                    <img
                                                        src={team.flag_url}
                                                        alt={team.name}
                                                        className="w-6 h-4 object-cover"
                                                    />
                                                )}
                                                <span className="font-medium">{team.name}</span>
                                            </div>

                                            {/* Round */}
                                            <div className="text-sm font-medium px-3 py-2 bg-white dark:bg-zinc-900 rounded-md">
                                                {TOURNAMENT_ROUND_LABELS[advance.predicted_round] || advance.predicted_round}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Matches */}
                    {predictionsMap.size > 0 && (
                        <div className="space-y-4">
                            {Object.entries(groupedMatches).map(([round, dates]) => {
                                // Check if this round has any predictions
                                const hasPredictionsInRound = Object.values(dates).some(matchesByDate =>
                                    matchesByDate.some(match => predictionsMap.has(match.id))
                                );
                                if (!hasPredictionsInRound) return null;

                                return (
                                    <div key={round} className="space-y-4">
                                        <h2 className="text-2xl font-bold tracking-tight">
                                            {ROUND_LABELS[round]}
                                        </h2>
                                        {round !== 'group' && (
                                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                                                En eliminatorias, el marcador corresponde a los 90 minutos. Si hay empate, el clasificado se define por el resultado oficial cargado por el administrador.
                                            </div>
                                        )}
                                        {Object.entries(dates).map(([date, matchesByDate]) => {
                                            // Check if this date has any predictions
                                            const hasPredictionsInDate = matchesByDate.some(match => predictionsMap.has(match.id));
                                            if (!hasPredictionsInDate) return null;

                                            return (
                                                <div key={date} className="space-y-3">
                                                    <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                                                        {formatMatchDateLong(date)}
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {matchesByDate.map(match => {
                                                            const pred = predictionsMap.get(match.id);
                                                            if (!pred) return null;

                                                            return (
                                                                <div
                                                                    key={match.id}
                                                                    className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4 space-y-3"
                                                                >
                                                                    {/* Match Number */}
                                                                    {match.match_number && (
                                                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                                            Partido #{match.match_number}
                                                                        </div>
                                                                    )}

                                                                    {/* Teams */}
                                                                    <div className="space-y-2">
                                                                        {/* Team 1 */}
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center space-x-2 flex-1">
                                                                                {match.team1 ? (
                                                                                    <>
                                                                                        {match.team1.flag_url && (
                                                                                            <img
                                                                                                src={match.team1.flag_url}
                                                                                                alt={match.team1.name}
                                                                                                className="w-6 h-4 object-cover"
                                                                                            />
                                                                                        )}
                                                                                        <span className="font-medium">{match.team1.name}</span>
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-zinc-400 dark:text-zinc-500">
                                                                                        {match.team1_slot} <span className="text-xs">(pendiente)</span>
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className="font-bold text-lg">{pred.predicted_team1_score}</span>
                                                                        </div>

                                                                        {/* Team 2 */}
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center space-x-2 flex-1">
                                                                                {match.team2 ? (
                                                                                    <>
                                                                                        {match.team2.flag_url && (
                                                                                            <img
                                                                                                src={match.team2.flag_url}
                                                                                                alt={match.team2.name}
                                                                                                className="w-6 h-4 object-cover"
                                                                                            />
                                                                                        )}
                                                                                        <span className="font-medium">{match.team2.name}</span>
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-zinc-400 dark:text-zinc-500">
                                                                                        {match.team2_slot} <span className="text-xs">(pendiente)</span>
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className="font-bold text-lg">{pred.predicted_team2_score}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Date, Time, Venue */}
                                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                                                                        <div className="flex items-center space-x-2">
                                                                            <span>🕐 {match.match_time}</span>
                                                                            <span className="text-zinc-400 dark:text-zinc-500">(Hora Colombia)</span>
                                                                        </div>
                                                                        <div>📍 {match.venue}</div>
                                                                        {match.group_code && (
                                                                            <div>Grupo {match.group_code}</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
