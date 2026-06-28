'use client';

import { useState } from 'react';
import { triggerRecalculateGroupScores } from '@/server/actions/recalculateScores';

interface RecalculateScoresClientProps {
  globalGroupId: string;
}

export default function RecalculateScoresClient({ globalGroupId }: RecalculateScoresClientProps) {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; usersProcessed?: number } | null>(null);

  const handleRecalculate = async () => {
    const confirmed = window.confirm(
      '¿Estás seguro de que deseas recalcular las puntuaciones del grupo global?\n\n' +
      'Esta acción modificará score_breakdowns en la base de datos. ' +
      'Úsala solo después de corregir reglas de puntuación o registrar resultados oficiales.'
    );

    if (!confirmed) {
      return;
    }

    setIsRecalculating(true);
    setResult(null);

    try {
      const response = await triggerRecalculateGroupScores(globalGroupId);
      setResult({
        success: response.success,
        message: response.success
          ? `Puntuaciones recalculadas exitosamente. Se procesaron ${response.result?.usersProcessed || 0} usuarios.`
          : `Error: ${response.error}`,
        usersProcessed: response.result?.usersProcessed,
      });
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
        <p className="text-yellow-800 dark:text-yellow-200 text-sm">
          <strong>Advertencia:</strong> Esta acción modifica score_breakdowns en la base de datos. 
          Úsala solo después de corregir reglas de puntuación o registrar resultados oficiales.
        </p>
      </div>

      <button
        onClick={handleRecalculate}
        disabled={isRecalculating}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
      >
        {isRecalculating ? 'Recalculando...' : 'Recalcular puntuaciones del grupo global'}
      </button>

      {result && (
        <div className={`p-4 rounded-lg ${
          result.success 
            ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200' 
            : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
        }`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
