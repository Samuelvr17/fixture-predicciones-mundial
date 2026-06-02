import type { BracketOutput, ResolvedMatch } from '@/lib/tournament/bracket';
import BracketMatchCard from './BracketMatchCard';
import BracketCanvas from './BracketCanvas';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';
import { buildBracketLayout } from '@/lib/tournament/bracketLayout';
import { formatSlotLabel } from '@/lib/tournament/slotLabels';

interface BracketViewProps {
  bracket: BracketOutput;
  teams: Map<string, { name: string; display_name_es?: string | null; code: string }>;
}

export default function BracketView({ bracket, teams }: BracketViewProps) {
  const { matches, champion, thirdPlace } = bracket;
  const layout = buildBracketLayout(matches, {
    cardHeightRem: 7.6,
    firstRoundGapRem: 2.2,
    minBracketHeightRem: 56,
  });

  const getTeamInfo = (teamId?: string) => {
    if (!teamId) return undefined;
    return teams.get(teamId);
  };

  const renderMatchCard = (match: ResolvedMatch) => {
    const team1Info = getTeamInfo(match.team1_id);
    const team2Info = getTeamInfo(match.team2_id);
    const team1SourceLabel = formatSlotLabel(match.team1_slot ?? match.match.team1_slot);
    const team2SourceLabel = formatSlotLabel(match.team2_slot ?? match.match.team2_slot);

    return (
      <BracketMatchCard
        match={match}
        team1Name={getTeamDisplayName(team1Info)}
        team2Name={getTeamDisplayName(team2Info)}
        team1Code={team1Info?.code}
        team2Code={team2Info?.code}
        team1SourceLabel={team1SourceLabel}
        team2SourceLabel={team2SourceLabel}
      />
    );
  };

  const renderChampionSummary = () => {
    if (!champion && !thirdPlace) return null;

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {champion && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
              Campeón
            </div>
            <div className="mt-1 text-xl font-black text-amber-950 dark:text-amber-50">
              {getTeamDisplayName(getTeamInfo(champion))}
            </div>
          </div>
        )}
        {thirdPlace && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm dark:border-sky-800 dark:bg-sky-950/30">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
              Tercer puesto
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
    <div className="space-y-6">
      <BracketCanvas
        layout={layout}
        cardWidthClassName="w-56"
        centerWidthClassName="w-60"
        centerHeaderTitle="Mundial 2026"
        centerHeaderSubtitle="definición"
        finalTitle="🏆 Final"
        thirdPlaceTitle="Tercer puesto"
        ariaLabel="Llaves eliminatorias con desplazamiento horizontal"
        topSummary={renderChampionSummary()}
        renderMatchCard={renderMatchCard}
      />

      {bracket.pendingSlots.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
            <div>
              <h3 className="mb-1 font-semibold text-amber-800 dark:text-amber-300">
                Slots pendientes
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Hay {bracket.pendingSlots.length} slots que aún no pueden resolverse. Esto puede
                deberse a resultados faltantes o desempates por definir.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
