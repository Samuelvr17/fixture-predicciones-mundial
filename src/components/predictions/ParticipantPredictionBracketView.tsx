import type { BracketOutput, ResolvedMatch } from '@/lib/tournament/bracket';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';
import { buildBracketLayout } from '@/lib/tournament/bracketLayout';
import type { Database } from '@/types/database.types';
import BracketCanvas from '@/components/bracket/BracketCanvas';
import ParticipantPredictionBracketMatchCard from './ParticipantPredictionBracketMatchCard';

type Team = Database['public']['Tables']['teams']['Row'];
type Prediction = Database['public']['Tables']['predictions_scores']['Row'];

type ParticipantPredictionBracketViewProps = {
  bracket: BracketOutput;
  teams: Map<string, Team>;
  predictionsMap: Map<string, Prediction>;
};

export default function ParticipantPredictionBracketView({
  bracket,
  teams,
  predictionsMap,
}: ParticipantPredictionBracketViewProps) {
  const { matches, champion, thirdPlace } = bracket;
  const layout = buildBracketLayout(matches, {
    cardHeightRem: 8.55,
    firstRoundGapRem: 2.3,
    minBracketHeightRem: 62,
  });

  const hasPendingPredictionState = matches.some((match) => {
    const prediction = predictionsMap.get(match.match.id);
    return (
      !prediction ||
      match.pendingSlots.length > 0 ||
      (prediction.predicted_team1_score === prediction.predicted_team2_score &&
        !prediction.predicted_winner_team_id)
    );
  });

  const getTeamInfo = (teamId?: string) => {
    if (!teamId) return undefined;
    return teams.get(teamId);
  };

  const renderMatchCard = (match: ResolvedMatch) => (
    <ParticipantPredictionBracketMatchCard
      match={match}
      teams={teams}
      prediction={predictionsMap.get(match.match.id)}
    />
  );

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

  const pendingNotice = hasPendingPredictionState ? (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
      Algunos partidos pueden aparecer pendientes porque faltan predicciones o desempates en la predicción del participante.
    </div>
  ) : undefined;

  return (
    <BracketCanvas
      layout={layout}
      cardWidthClassName="w-60"
      centerWidthClassName="w-64"
      centerHeaderTitle="Predicción eliminatoria"
      centerHeaderSubtitle="definición"
      finalTitle="🏆 Final"
      thirdPlaceTitle="Tercer puesto"
      ariaLabel="Llave de eliminatorias predicha con desplazamiento horizontal"
      pendingNotice={pendingNotice}
      topSummary={renderChampionSummary()}
      renderMatchCard={renderMatchCard}
    />
  );
}
