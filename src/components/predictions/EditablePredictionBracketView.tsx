import type { ResolvedMatch } from '@/lib/tournament/bracket';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';
import { buildBracketLayout } from '@/lib/tournament/bracketLayout';
import type { Database } from '@/types/database.types';
import BracketCanvas from '@/components/bracket/BracketCanvas';
import EditableBracketMatchCard from './EditableBracketMatchCard';

type Team = Database['public']['Tables']['teams']['Row'];

interface EditablePredictionBracketViewProps {
  bracket: {
    matches: ResolvedMatch[];
    champion: string | null;
    thirdPlace: string | null;
  };
  teams: Map<string, Team>;
  predictions: Record<string, { team1: string; team2: string }>;
  predictedWinners: Record<string, string | null>;
  isBeforeDeadline: boolean;
  saving: Record<string, boolean>;
  errors: Record<string, string>;
  success: Record<string, boolean>;
  onPredictionChange: (matchId: string, team: 'team1' | 'team2', value: string) => void;
  onWinnerChange: (matchId: string, winnerId: string | null) => void;
  onSavePrediction: (matchId: string) => void;
}

const EDITABLE_BRACKET_SLOT_HEIGHT_REM = 12.5;

export default function EditablePredictionBracketView({
  bracket,
  teams,
  predictions,
  predictedWinners,
  isBeforeDeadline,
  saving,
  errors,
  success,
  onPredictionChange,
  onWinnerChange,
  onSavePrediction,
}: EditablePredictionBracketViewProps) {
  const { matches, champion, thirdPlace } = bracket;
  const layout = buildBracketLayout(matches, {
    cardHeightRem: EDITABLE_BRACKET_SLOT_HEIGHT_REM,
    firstRoundGapRem: 1.5,
    minBracketHeightRem: 85,
  });

  const hasPendingPredictionState = matches.some((match) => {
    const pred = predictions[match.match.id];
    const team1Score = parseInt(pred?.team1 ?? '0', 10) || 0;
    const team2Score = parseInt(pred?.team2 ?? '0', 10) || 0;
    const isTie = team1Score === team2Score;
    
    return (
      match.pendingSlots.length > 0 ||
      (isTie && !predictedWinners[match.match.id])
    );
  });

  const getTeamInfo = (teamId?: string) => {
    if (!teamId) return undefined;
    return teams.get(teamId);
  };

  const renderMatchCard = (match: ResolvedMatch) => {
    const pred = predictions[match.match.id] || { team1: '0', team2: '0' };

    return (
      <div className="flex h-[12.5rem] items-center">
        <EditableBracketMatchCard
          key={match.match.id}
          match={match}
          teams={teams}
          team1Score={pred.team1}
          team2Score={pred.team2}
          predictedWinner={predictedWinners[match.match.id] ?? null}
          isBeforeDeadline={isBeforeDeadline}
          isSaving={saving[match.match.id] || false}
          error={errors[match.match.id]}
          success={success[match.match.id] || false}
          onTeam1ScoreChange={(value) => onPredictionChange(match.match.id, 'team1', value)}
          onTeam2ScoreChange={(value) => onPredictionChange(match.match.id, 'team2', value)}
          onWinnerChange={(winnerId) => onWinnerChange(match.match.id, winnerId)}
          onSave={() => onSavePrediction(match.match.id)}
        />
      </div>
    );
  };

  const renderChampionSummary = () => {
    if (!champion && !thirdPlace) return null;

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {champion && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
              Campeón predicho
            </div>
            <div className="mt-1 text-xl font-black text-amber-950 dark:text-amber-50">
              {getTeamDisplayName(getTeamInfo(champion))}
            </div>
          </div>
        )}
        {thirdPlace && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm dark:border-sky-800 dark:bg-sky-950/30">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
              Tercer puesto predicho
            </div>
            <div className="mt-1 text-xl font-black text-sky-950 dark:text-sky-50">
              {getTeamDisplayName(getTeamInfo(thirdPlace))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <BracketCanvas
      layout={layout}
      cardWidthClassName="w-72 sm:w-80"
      centerWidthClassName="w-72 sm:w-80"
      centerHeaderTitle="Predicción eliminatoria"
      centerHeaderSubtitle="editable"
      finalTitle="🏆 Final"
      thirdPlaceTitle="Tercer puesto"
      ariaLabel="Llave de eliminatorias editable con desplazamiento horizontal"
      topSummary={renderChampionSummary()}
      renderMatchCard={renderMatchCard}
    />
  );
}
