'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
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

interface MyPredictionsClientProps {
    matches: MatchWithTeam[];
    predictionsMap: Map<string, Prediction>;
    groupId: string;
    isBeforeDeadline: boolean;
    deadline: string;
    teams: Team[];
    advancesMap: Map<string, AdvancePrediction>;
    specialPrediction: SpecialPrediction | null;
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

const TOURNAMENT_ROUND_OPTIONS = [
    { value: 'no_clasifica', label: 'No Clasifica' },
    { value: 'round_of_32', label: 'Dieciseisavos' },
    { value: 'round_of_16', label: 'Octavos' },
    { value: 'quarter_final', label: 'Cuartos' },
    { value: 'semi_final', label: 'Semifinales' },
    { value: 'final', label: 'Final' },
    { value: 'champion', label: 'Campeón' }
] as const;

export default function MyPredictionsClient({
    matches,
    predictionsMap,
    groupId,
    isBeforeDeadline,
    deadline,
    teams,
    advancesMap,
    specialPrediction
}: MyPredictionsClientProps) {
    const supabase = createClient();
    const [predictions, setPredictions] = useState<Record<string, { team1: number; team2: number }>>(() => {
        const initial: Record<string, { team1: number; team2: number }> = {};
        matches.forEach(match => {
            const pred = predictionsMap.get(match.id);
            if (pred) {
                initial[match.id] = {
                    team1: pred.predicted_team1_score,
                    team2: pred.predicted_team2_score
                };
            } else {
                initial[match.id] = { team1: 0, team2: 0 };
            }
        });
        return initial;
    });

    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [success, setSuccess] = useState<Record<string, boolean>>({});

    // State for advance predictions
    const [advances, setAdvances] = useState<Record<string, Database['public']['Enums']['tournament_round']>>(() => {
        const initial: Record<string, Database['public']['Enums']['tournament_round']> = {};
        teams.forEach(team => {
            const advance = advancesMap.get(team.id);
            if (advance) {
                initial[team.id] = advance.predicted_round;
            } else {
                initial[team.id] = 'no_clasifica'; // Default value
            }
        });
        return initial;
    });

    // State for special predictions
    const [specials, setSpecials] = useState<{
        champion_team_id: string | null;
        third_place_team_id: string | null;
        top_scorer_name: string;
    }>(() => ({
        champion_team_id: specialPrediction?.champion_team_id || null,
        third_place_team_id: specialPrediction?.third_place_team_id || null,
        top_scorer_name: specialPrediction?.top_scorer_name || ''
    }));

    const [savingSpecials, setSavingSpecials] = useState(false);
    const [specialsError, setSpecialsError] = useState<string | null>(null);
    const [specialsSuccess, setSpecialsSuccess] = useState(false);

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

    const handlePredictionChange = (matchId: string, team: 'team1' | 'team2', value: string) => {
        const numValue = parseInt(value, 10);
        
        // Validate non-negative integer
        if (isNaN(numValue) || numValue < 0) {
            setErrors(prev => ({
                ...prev,
                [matchId]: 'Los goles deben ser un número entero >= 0'
            }));
            return;
        }

        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[matchId];
            return newErrors;
        });

        setPredictions(prev => ({
            ...prev,
            [matchId]: {
                ...prev[matchId],
                [team]: numValue
            }
        }));
    };

    const handleSavePrediction = async (matchId: string) => {
        const pred = predictions[matchId];
        if (!pred) return;

        setSaving(prev => ({ ...prev, [matchId]: true }));
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[matchId];
            return newErrors;
        });
        setSuccess(prev => ({ ...prev, [matchId]: false }));

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setErrors(prev => ({
                    ...prev,
                    [matchId]: 'No autenticado'
                }));
                return;
            }

            // Check if prediction already exists
            const existingPrediction = predictionsMap.get(matchId);

            if (existingPrediction) {
                // Update existing prediction
                const { error } = await supabase
                    .from('predictions_scores')
                    .update({
                        predicted_team1_score: pred.team1,
                        predicted_team2_score: pred.team2
                    })
                    .eq('id', existingPrediction.id);

                if (error) {
                    setErrors(prev => ({
                        ...prev,
                        [matchId]: error.message
                    }));
                } else {
                    setSuccess(prev => ({ ...prev, [matchId]: true }));
                    // Update predictionsMap
                    predictionsMap.set(matchId, {
                        ...existingPrediction,
                        predicted_team1_score: pred.team1,
                        predicted_team2_score: pred.team2
                    });
                }
            } else {
                // Insert new prediction
                const { error } = await supabase
                    .from('predictions_scores')
                    .insert({
                        group_id: groupId,
                        user_id: user.id,
                        match_id: matchId,
                        predicted_team1_score: pred.team1,
                        predicted_team2_score: pred.team2
                    });

                if (error) {
                    setErrors(prev => ({
                        ...prev,
                        [matchId]: error.message
                    }));
                } else {
                    setSuccess(prev => ({ ...prev, [matchId]: true }));
                    // Fetch the newly created prediction and add to map
                    const { data: newPred } = await supabase
                        .from('predictions_scores')
                        .select('*')
                        .eq('group_id', groupId)
                        .eq('user_id', user.id)
                        .eq('match_id', matchId)
                        .single();
                    
                    if (newPred) {
                        predictionsMap.set(matchId, newPred);
                    }
                }
            }
        } catch (error) {
            setErrors(prev => ({
                ...prev,
                [matchId]: 'Error al guardar predicción'
            }));
        } finally {
            setSaving(prev => ({ ...prev, [matchId]: false }));
        }
    };

    const handleSaveAdvance = async (teamId: string) => {
        const predictedRound = advances[teamId];
        if (!predictedRound) return;

        setSaving(prev => ({ ...prev, [teamId]: true }));
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[teamId];
            return newErrors;
        });
        setSuccess(prev => ({ ...prev, [teamId]: false }));

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setErrors(prev => ({
                    ...prev,
                    [teamId]: 'No autenticado'
                }));
                return;
            }

            // Check if advance prediction already exists
            const existingAdvance = advancesMap.get(teamId);

            if (existingAdvance) {
                // Update existing advance prediction
                const { error } = await supabase
                    .from('predictions_advances')
                    .update({
                        predicted_round: predictedRound
                    })
                    .eq('id', existingAdvance.id);

                if (error) {
                    setErrors(prev => ({
                        ...prev,
                        [teamId]: error.message
                    }));
                } else {
                    setSuccess(prev => ({ ...prev, [teamId]: true }));
                    // Update advancesMap
                    advancesMap.set(teamId, {
                        ...existingAdvance,
                        predicted_round: predictedRound
                    });
                }
            } else {
                // Insert new advance prediction
                const { error } = await supabase
                    .from('predictions_advances')
                    .insert({
                        group_id: groupId,
                        user_id: user.id,
                        team_id: teamId,
                        predicted_round: predictedRound
                    });

                if (error) {
                    setErrors(prev => ({
                        ...prev,
                        [teamId]: error.message
                    }));
                } else {
                    setSuccess(prev => ({ ...prev, [teamId]: true }));
                    // Fetch the newly created advance prediction and add to map
                    const { data: newAdvance } = await supabase
                        .from('predictions_advances')
                        .select('*')
                        .eq('group_id', groupId)
                        .eq('user_id', user.id)
                        .eq('team_id', teamId)
                        .single();
                    
                    if (newAdvance) {
                        advancesMap.set(teamId, newAdvance);
                    }
                }
            }
        } catch (error) {
            setErrors(prev => ({
                ...prev,
                [teamId]: 'Error al guardar predicción de avance'
            }));
        } finally {
            setSaving(prev => ({ ...prev, [teamId]: false }));
        }
    };

    const handleSaveSpecials = async () => {
        setSavingSpecials(true);
        setSpecialsError(null);
        setSpecialsSuccess(false);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSpecialsError('No autenticado');
                return;
            }

            // Check if special prediction already exists
            if (specialPrediction) {
                // Update existing special prediction
                const { error } = await supabase
                    .from('predictions_specials')
                    .update({
                        champion_team_id: specials.champion_team_id,
                        third_place_team_id: specials.third_place_team_id,
                        top_scorer_name: specials.top_scorer_name
                    })
                    .eq('id', specialPrediction.id);

                if (error) {
                    setSpecialsError(error.message);
                } else {
                    setSpecialsSuccess(true);
                }
            } else {
                // Insert new special prediction
                const { error } = await supabase
                    .from('predictions_specials')
                    .insert({
                        group_id: groupId,
                        user_id: user.id,
                        champion_team_id: specials.champion_team_id,
                        third_place_team_id: specials.third_place_team_id,
                        top_scorer_name: specials.top_scorer_name
                    });

                if (error) {
                    setSpecialsError(error.message);
                } else {
                    setSpecialsSuccess(true);
                }
            }
        } catch (error) {
            setSpecialsError('Error al guardar predicciones especiales');
        } finally {
            setSavingSpecials(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Deadline warning */}
            {isBeforeDeadline && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-blue-800 dark:text-blue-200 font-medium">
                        ℹ️ Puedes editar tus predicciones hasta: {new Date(deadline).toLocaleString('es-ES')}
                    </p>
                </div>
            )}

            {/* Special Predictions */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 space-y-6">
                <h2 className="text-2xl font-bold tracking-tight">Predicciones Especiales</h2>
                
                {/* Champion */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">🏆 Campeón</label>
                    <select
                        value={specials.champion_team_id || ''}
                        onChange={(e) => setSpecials(prev => ({ ...prev, champion_team_id: e.target.value || null }))}
                        disabled={!isBeforeDeadline}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                    >
                        <option value="">Seleccionar campeón</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>
                                {team.flag_url && `${team.flag_url} `}{team.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Third Place */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">🥉 Tercer Puesto</label>
                    <select
                        value={specials.third_place_team_id || ''}
                        onChange={(e) => setSpecials(prev => ({ ...prev, third_place_team_id: e.target.value || null }))}
                        disabled={!isBeforeDeadline}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                    >
                        <option value="">Seleccionar tercer puesto</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>
                                {team.flag_url && `${team.flag_url} `}{team.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Top Scorer */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">⚽ Goleador del Torneo</label>
                    <input
                        type="text"
                        value={specials.top_scorer_name}
                        onChange={(e) => setSpecials(prev => ({ ...prev, top_scorer_name: e.target.value }))}
                        disabled={!isBeforeDeadline}
                        placeholder="Nombre del jugador goleador"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                    />
                </div>

                {/* Special Predictions Status */}
                {specialsError && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                        {specialsError}
                    </div>
                )}
                {specialsSuccess && (
                    <div className="text-sm text-green-600 dark:text-green-400">
                        ✓ Guardado
                    </div>
                )}

                {/* Save Special Predictions Button */}
                {isBeforeDeadline && (
                    <button
                        onClick={handleSaveSpecials}
                        disabled={savingSpecials}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded transition-colors"
                    >
                        {savingSpecials ? 'Guardando...' : 'Guardar predicciones especiales'}
                    </button>
                )}
            </div>

            {/* Team Advances */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 space-y-6">
                <h2 className="text-2xl font-bold tracking-tight">Avance Máximo por Selección</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Predice hasta qué ronda llegará cada selección.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map(team => {
                        const currentAdvance = advances[team.id];
                        const isSaved = advancesMap.has(team.id);
                        const hasChanges = isSaved && advancesMap.get(team.id)!.predicted_round !== currentAdvance;

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

                                {/* Round Selector */}
                                {isBeforeDeadline ? (
                                    <select
                                        value={currentAdvance}
                                        onChange={(e) => setAdvances(prev => ({
                                            ...prev,
                                            [team.id]: e.target.value as Database['public']['Enums']['tournament_round']
                                        }))}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                    >
                                        {TOURNAMENT_ROUND_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="text-sm font-medium">
                                        {TOURNAMENT_ROUND_OPTIONS.find(opt => opt.value === currentAdvance)?.label}
                                    </div>
                                )}

                                {/* Status */}
                                {errors[team.id] && (
                                    <div className="text-sm text-red-600 dark:text-red-400">
                                        {errors[team.id]}
                                    </div>
                                )}
                                {success[team.id] && (
                                    <div className="text-sm text-green-600 dark:text-green-400">
                                        ✓ Guardado
                                    </div>
                                )}

                                {/* Save Button */}
                                {isBeforeDeadline && (
                                    <button
                                        onClick={() => handleSaveAdvance(team.id)}
                                        disabled={saving[team.id]}
                                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded transition-colors text-sm"
                                    >
                                        {saving[team.id] ? 'Guardando...' : hasChanges ? 'Guardar cambios' : 'Guardar'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Matches */}
            {Object.entries(groupedMatches).map(([round, dates]) => (
                <div key={round} className="space-y-4">
                    <h2 className="text-2xl font-bold tracking-tight">
                        {ROUND_LABELS[round]}
                    </h2>
                    {round !== 'group' && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                            En eliminatorias, el marcador corresponde a los 90 minutos. Si hay empate, el clasificado se define por el resultado oficial cargado por el administrador.
                        </div>
                    )}
                    {Object.entries(dates).map(([date, matchesByDate]) => (
                        <div key={date} className="space-y-3">
                            <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                                {formatMatchDateLong(date)}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {matchesByDate.map(match => {
                                    const pred = predictions[match.id] || { team1: 0, team2: 0 };
                                    const isSaved = predictionsMap.has(match.id);
                                    const hasChanges = isSaved && (
                                        predictionsMap.get(match.id)!.predicted_team1_score !== pred.team1 ||
                                        predictionsMap.get(match.id)!.predicted_team2_score !== pred.team2
                                    );

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
                                                    {isBeforeDeadline ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={pred.team1}
                                                            onChange={(e) => handlePredictionChange(match.id, 'team1', e.target.value)}
                                                            className="w-16 px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded text-center bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                                            disabled={!isBeforeDeadline}
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-lg">{pred.team1}</span>
                                                    )}
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
                                                    {isBeforeDeadline ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={pred.team2}
                                                            onChange={(e) => handlePredictionChange(match.id, 'team2', e.target.value)}
                                                            className="w-16 px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded text-center bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                                            disabled={!isBeforeDeadline}
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-lg">{pred.team2}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Status */}
                                            {errors[match.id] && (
                                                <div className="text-sm text-red-600 dark:text-red-400">
                                                    {errors[match.id]}
                                                </div>
                                            )}
                                            {success[match.id] && (
                                                <div className="text-sm text-green-600 dark:text-green-400">
                                                    ✓ Guardado
                                                </div>
                                            )}

                                            {/* Save Button */}
                                            {isBeforeDeadline && (
                                                <button
                                                    onClick={() => handleSavePrediction(match.id)}
                                                    disabled={saving[match.id] || !isBeforeDeadline}
                                                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded transition-colors"
                                                >
                                                    {saving[match.id] ? 'Guardando...' : hasChanges ? 'Guardar cambios' : 'Guardar'}
                                                </button>
                                            )}

                                            {/* Date, Time, Venue */}
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                                                <div className="flex items-center space-x-2">
                                                    <span>🕐 {match.match_time}</span>
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
                    ))}
                </div>
            ))}
        </div>
    );
}
