'use client';

import { useState, useTransition } from 'react';
import AwardCandidateSelect, { type AwardCandidate } from '@/components/awards/AwardCandidateSelect';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import type { Database } from '@/types/database.types';
import { saveTournamentResults } from '@/server/actions/saveTournamentResults';

type Team = Database['public']['Tables']['teams']['Row'];
type TournamentResults = Database['public']['Tables']['tournament_results']['Row'];

interface TournamentResultsClientProps {
  candidates: AwardCandidate[];
  teams: Team[];
  tournamentResults: TournamentResults | null;
}

export default function TournamentResultsClient({
  candidates,
  teams,
  tournamentResults,
}: TournamentResultsClientProps) {
  const [topScorerCandidateId, setTopScorerCandidateId] = useState<string | null>(
    tournamentResults?.top_scorer_candidate_id ?? null
  );
  const [bestGoalkeeperCandidateId, setBestGoalkeeperCandidateId] = useState<string | null>(
    tournamentResults?.best_goalkeeper_candidate_id ?? null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await saveTournamentResults({
        topScorerCandidateId,
        bestGoalkeeperCandidateId,
      });

      if (!result.success) {
        setError(result.error || 'No se pudieron guardar los resultados del torneo.');
        return;
      }

      setMessage(result.recalculationError
        ? `Guardado. Advertencia: ${result.recalculationError}`
        : 'Resultados oficiales guardados y puntajes recalculados.'
      );
    });
  };

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Premios del torneo</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Selecciona los ganadores oficiales de los premios individuales. Al guardar, se recalcularán los puntajes de todos los participantes.
        </p>
      </div>

      <AwardCandidateSelect
        candidates={candidates}
        teams={teams}
        value={topScorerCandidateId}
        onChange={(candidateId) => setTopScorerCandidateId(candidateId)}
        awardCategory="top_scorer"
        label="Goleador oficial del torneo"
        placeholder="Busca jugador por nombre, apellido o selección"
        helpText="Selecciona el goleador oficial desde la lista controlada."
      />

      <AwardCandidateSelect
        candidates={candidates}
        teams={teams}
        value={bestGoalkeeperCandidateId}
        onChange={(candidateId) => setBestGoalkeeperCandidateId(candidateId)}
        awardCategory="best_goalkeeper"
        label="Mejor arquero oficial del torneo"
        placeholder="Busca arquero por nombre, apellido o selección"
        helpText="Selecciona el mejor arquero oficial desde la lista controlada."
      />

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant={message.startsWith('Guardado. Advertencia') ? 'warning' : 'success'}>{message}</Alert>}

      <Button onClick={handleSave} disabled={isPending} className="w-full">
        {isPending ? 'Guardando y recalculando...' : 'Guardar resultados oficiales'}
      </Button>
    </Card>
  );
}
