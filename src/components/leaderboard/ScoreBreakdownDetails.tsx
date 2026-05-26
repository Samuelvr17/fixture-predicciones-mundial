'use client';

interface ScoreBreakdown {
    id: string;
    exact_scores_group_stage: number;
    correct_results_group_stage: number;
    exact_scores_knockout: number;
    advances_points: number;
    third_place_points: number;
    champion_points: number;
    top_scorer_points: number;
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
    role: 'admin' | 'member' | 'leader';
    joined_at: string;
    profiles: Profile;
    score_breakdowns: ScoreBreakdown | null;
}

interface ScoreBreakdownDetailsProps {
    member: Member;
    onClose: () => void;
}

export default function ScoreBreakdownDetails({ member, onClose }: ScoreBreakdownDetailsProps) {
    if (!member.score_breakdowns) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full p-6">
                    <p className="text-zinc-600 dark:text-zinc-400">No hay puntajes disponibles para este usuario.</p>
                    <button
                        onClick={onClose}
                        className="mt-4 w-full px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium rounded transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        );
    }

    const details = member.score_breakdowns.details;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                            Detalles de Puntaje
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                        {member.profiles.username}
                    </p>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="space-y-4">
                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                                Resumen
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-zinc-600 dark:text-zinc-400">Puntos Totales:</span>
                                    <span className="ml-2 font-bold text-zinc-900 dark:text-zinc-100">
                                        {member.score_breakdowns.total_points}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-zinc-600 dark:text-zinc-400">Última Actualización:</span>
                                    <span className="ml-2 text-zinc-900 dark:text-zinc-100">
                                        {member.score_breakdowns.last_calculated_at
                                            ? new Date(member.score_breakdowns.last_calculated_at).toLocaleString('es-ES')
                                            : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                                Desglose por Categoría
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">
                                        Marcadores Exactos (Fase de Grupos):
                                    </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {member.score_breakdowns.exact_scores_group_stage} pts
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">
                                        Resultados Correctos (Fase de Grupos):
                                    </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {member.score_breakdowns.correct_results_group_stage} pts
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">
                                        Marcadores Exactos (Eliminatorias):
                                    </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {member.score_breakdowns.exact_scores_knockout} pts
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">
                                        Avances de Ronda:
                                    </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {member.score_breakdowns.advances_points} pts
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">
                                        Campeón:
                                    </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {member.score_breakdowns.champion_points} pts
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">
                                        Tercer Puesto:
                                    </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {member.score_breakdowns.third_place_points} pts
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">
                                        Goleador:
                                    </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {member.score_breakdowns.top_scorer_points} pts
                                    </span>
                                </div>
                            </div>
                        </div>

                        {details && Object.keys(details).length > 0 && (
                            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                                    Detalles Técnicos (JSON)
                                </h3>
                                <pre className="text-xs text-zinc-700 dark:text-zinc-300 overflow-x-auto bg-white dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-700">
                                    {JSON.stringify(details, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium rounded transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
