import { BracketOutput, ResolvedMatch, Round } from '@/lib/tournament/bracket';
import BracketMatchCard from './BracketMatchCard';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';
import {
  BRACKET_LEFT_DISPLAY_ROUNDS,
  BRACKET_RIGHT_DISPLAY_ROUNDS,
  BRACKET_ROUND_ORDER,
  BRACKET_SIDE_MATCH_NUMBERS,
  BRACKET_SIDE_ROUNDS,
  getRoundLabel,
  type BracketSide,
} from '@/lib/tournament/display';
import { formatSlotLabel, getSlotMatchNumber } from '@/lib/tournament/slotLabels';

interface BracketViewProps {
  bracket: BracketOutput;
  teams: Map<string, { name: string; display_name_es?: string | null; code: string }>;
}

type PositionedMatch = {
  match: ResolvedMatch;
  topRem: number;
  centerRem: number;
};

type RoundLayout = {
  heightRem: number;
  positionedMatches: PositionedMatch[];
};

type ConnectorGroup = {
  id: string;
  sourceCentersRem: [number, number];
  targetCenterRem: number;
};

const BRACKET_CARD_HEIGHT_REM = 7.6;
const FIRST_ROUND_GAP_REM = 2.2;
const FIRST_ROUND_PITCH_REM = BRACKET_CARD_HEIGHT_REM + FIRST_ROUND_GAP_REM;
const MIN_COLUMN_HEIGHT_REM = BRACKET_CARD_HEIGHT_REM;

const getSourceMatchNumbers = (match: ResolvedMatch) =>
  [match.match.team1_slot, match.match.team2_slot]
    .map((slot) => getSlotMatchNumber(slot))
    .filter((matchNumber): matchNumber is number => matchNumber !== undefined);

const getAverage = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;

const createRoundLayouts = (matchesByRound: Map<Round, ResolvedMatch[]>) => {
  const layouts = new Map<Round, RoundLayout>();
  const matchCentersByNumber = new Map<number, number>();

  for (const round of BRACKET_SIDE_ROUNDS) {
    const roundMatches = matchesByRound.get(round) ?? [];
    const isFirstRound = round === BRACKET_SIDE_ROUNDS[0];

    const positionedMatches = roundMatches.map((match, index) => {
      const sourceCenters = getSourceMatchNumbers(match)
        .map((matchNumber) => matchCentersByNumber.get(matchNumber))
        .filter((center): center is number => center !== undefined);

      const centerRem =
        !isFirstRound && sourceCenters.length > 0
          ? getAverage(sourceCenters)
          : index * FIRST_ROUND_PITCH_REM + BRACKET_CARD_HEIGHT_REM / 2;
      const topRem = Math.max(0, centerRem - BRACKET_CARD_HEIGHT_REM / 2);

      return { match, topRem, centerRem };
    });

    for (const positionedMatch of positionedMatches) {
      const matchNumber = positionedMatch.match.match.num;
      if (matchNumber !== undefined) {
        matchCentersByNumber.set(matchNumber, positionedMatch.centerRem);
      }
    }

    const heightRem = Math.max(
      MIN_COLUMN_HEIGHT_REM,
      ...positionedMatches.map(
        (positionedMatch) => positionedMatch.topRem + BRACKET_CARD_HEIGHT_REM,
      ),
    );

    layouts.set(round, { heightRem, positionedMatches });
  }

  return layouts;
};

const getNextSideRound = (round: Round) => {
  const roundIndex = BRACKET_SIDE_ROUNDS.indexOf(round);

  if (roundIndex === -1 || roundIndex === BRACKET_SIDE_ROUNDS.length - 1) {
    return undefined;
  }

  return BRACKET_SIDE_ROUNDS[roundIndex + 1];
};

const createConnectorGroups = (
  round: Round,
  roundLayouts: Map<Round, RoundLayout>,
): ConnectorGroup[] => {
  const sourceMatches = roundLayouts.get(round)?.positionedMatches ?? [];
  const nextRound = getNextSideRound(round);
  const targetMatches = nextRound
    ? roundLayouts.get(nextRound)?.positionedMatches ?? []
    : [];

  return targetMatches.flatMap((targetMatch) => {
    const sourceCenters = getSourceMatchNumbers(targetMatch.match)
      .map((matchNumber) =>
        sourceMatches.find((sourceMatch) => sourceMatch.match.match.num === matchNumber),
      )
      .filter((sourceMatch): sourceMatch is PositionedMatch => sourceMatch !== undefined)
      .map((sourceMatch) => sourceMatch.centerRem);

    if (sourceCenters.length !== 2) return [];

    return [
      {
        id: `${round}-${targetMatch.match.match.id}`,
        sourceCentersRem: [sourceCenters[0], sourceCenters[1]],
        targetCenterRem: targetMatch.centerRem,
      },
    ];
  });
};

const getSlotSourceLabel = (slot?: string) => {
  if (!slot) return undefined;

  const previousMatchSlot = slot.match(/^([WL])(\d+)$/);
  if (previousMatchSlot) {
    const [, resultType, matchNumber] = previousMatchSlot;
    return `${resultType === 'W' ? 'Ganador' : 'Perdedor'} P${matchNumber}`;
  }

  const groupPositionSlot = slot.match(/^([12])([A-L])$/);
  if (groupPositionSlot) {
    const [, position, groupCode] = groupPositionSlot;
    return `${position}.º Grupo ${groupCode}`;
  }

  if (slot.startsWith('3')) {
    const groups = slot.slice(1);
    return groups ? `Mejor 3.º ${groups}` : 'Mejor 3.º';
  }

  return `Origen ${slot}`;
};

export default function BracketView({ bracket, teams }: BracketViewProps) {
  const { matches, champion, thirdPlace } = bracket;

  const matchesByRound = new Map<Round, ResolvedMatch[]>();
  for (const round of BRACKET_ROUND_ORDER) {
    matchesByRound.set(round, []);
  }

  for (const match of matches) {
    const round = match.match.round;
    if (matchesByRound.has(round)) {
      matchesByRound.get(round)!.push(match);
    }
  }

  for (const roundMatches of matchesByRound.values()) {
    roundMatches.sort((a, b) => {
      if (a.match.num !== undefined && b.match.num !== undefined) {
        return a.match.num - b.match.num;
      }
      return 0;
    });
  }

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

  const sideMatchesByRound = (side: BracketSide) => {
    const sideMap = new Map<Round, ResolvedMatch[]>();

    for (const round of BRACKET_SIDE_ROUNDS) {
      const matchesForRound = matchesByRound.get(round) ?? [];
      const orderedMatchNumbers = BRACKET_SIDE_MATCH_NUMBERS[side][round] ?? [];
      const matchesByNumber = new Map(
        matchesForRound.map((match) => [match.match.num, match] as const),
      );

      sideMap.set(
        round,
        orderedMatchNumbers
          .map((matchNumber) => matchesByNumber.get(matchNumber))
          .filter((match): match is ResolvedMatch => match !== undefined),
      );
    }

    return sideMap;
  };

  const leftMatchesByRound = sideMatchesByRound('left');
  const rightMatchesByRound = sideMatchesByRound('right');
  const leftLayouts = createRoundLayouts(leftMatchesByRound);
  const rightLayouts = createRoundLayouts(rightMatchesByRound);
  const bracketHeightRem = Math.max(
    ...BRACKET_SIDE_ROUNDS.flatMap((round) => [
      leftLayouts.get(round)?.heightRem ?? 0,
      rightLayouts.get(round)?.heightRem ?? 0,
    ]),
    56,
  );

  const finalMatch = matchesByRound.get('final')?.[0];
  const thirdPlaceMatch = matchesByRound.get('third_place')?.[0];
  const finalLabelOffsetRem = 1.75;
  const finalTopRem = Math.max(
    0,
    bracketHeightRem / 2 - finalLabelOffsetRem - BRACKET_CARD_HEIGHT_REM / 2,
  );
  const thirdPlaceTopRem = finalTopRem + finalLabelOffsetRem + BRACKET_CARD_HEIGHT_REM + 2.3;

  const renderRoundHeader = (round: Round, count: number) => (
    <div className="rounded-md bg-slate-950 px-3 py-2 text-center text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950">
      <h2 className="text-[11px] font-black uppercase tracking-[0.18em]">
        {getRoundLabel(round)}
      </h2>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-300 dark:text-zinc-600">
        {count} partidos
      </p>
    </div>
  );

  const renderConnectors = (
    round: Round,
    layouts: Map<Round, RoundLayout>,
    side: BracketSide,
  ) =>
    createConnectorGroups(round, layouts).map((connector) => {
      const [firstSourceCenterRem, secondSourceCenterRem] = connector.sourceCentersRem;
      const topCenterRem = Math.min(firstSourceCenterRem, secondSourceCenterRem);
      const bottomCenterRem = Math.max(firstSourceCenterRem, secondSourceCenterRem);
      const verticalHeightRem = bottomCenterRem - topCenterRem;
      const horizontalSideClasses =
        side === 'left'
          ? {
              source: 'left-[calc(100%+0.25rem)]',
              vertical: 'left-[calc(100%+1rem)]',
              target: 'left-[calc(100%+1rem)]',
              targetWidth: 'w-3',
              targetOrigin: '',
              dot: 'left-[calc(100%+1rem)] -translate-x-1/2',
            }
          : {
              source: 'right-[calc(100%+0.25rem)]',
              vertical: 'right-[calc(100%+1rem)]',
              target: 'right-[calc(100%+1rem)]',
              targetWidth: 'w-3',
              targetOrigin: '',
              dot: 'right-[calc(100%+1rem)] translate-x-1/2',
            };

      return (
        <div key={connector.id} className="pointer-events-none absolute inset-0 z-0">
          {connector.sourceCentersRem.map((sourceCenterRem) => (
            <div key={`${connector.id}-${sourceCenterRem}`}>
              <div
                className={`absolute ${horizontalSideClasses.source} w-3 border-t-2 border-slate-400 dark:border-zinc-500`}
                style={{ top: `${sourceCenterRem}rem` }}
              />
              <div
                className={`absolute ${horizontalSideClasses.dot} h-2 w-2 -translate-y-1/2 rounded-full bg-slate-400 dark:bg-zinc-500`}
                style={{ top: `${sourceCenterRem}rem` }}
              />
            </div>
          ))}
          <div
            className={`absolute ${horizontalSideClasses.vertical} border-r-[3px] border-slate-400 dark:border-zinc-500`}
            style={{
              top: `${topCenterRem}rem`,
              height: `${verticalHeightRem}rem`,
            }}
          />
          <div
            className={`absolute ${horizontalSideClasses.target} ${horizontalSideClasses.targetWidth} ${horizontalSideClasses.targetOrigin} border-t-[3px] border-slate-500 dark:border-zinc-400`}
            style={{ top: `${connector.targetCenterRem}rem` }}
          />
        </div>
      );
    });

  const renderPositionedRound = (
    round: Round,
    layouts: Map<Round, RoundLayout>,
    side: BracketSide,
  ) => {
    const layout = layouts.get(round);
    const matchesCount = layout?.positionedMatches.length ?? 0;

    return (
      <section key={`${side}-${round}`} className="w-56 shrink-0 space-y-5">
        {renderRoundHeader(round, matchesCount)}
        <div className="relative overflow-visible" style={{ height: `${bracketHeightRem}rem` }}>
          {layout && renderConnectors(round, layouts, side)}
          {layout?.positionedMatches.map((positionedMatch) => (
            <div
              key={positionedMatch.match.match.id}
              className="absolute left-0 right-0 z-20"
              style={{ top: `${positionedMatch.topRem}rem` }}
            >
              {renderMatchCard(positionedMatch.match)}
            </div>
          ))}
        </div>
      </section>
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
      {renderChampionSummary()}

      <div
        className="overflow-x-auto overscroll-x-contain pb-4"
        aria-label="Llaves eliminatorias con desplazamiento horizontal"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex min-w-max items-start gap-8">
            {BRACKET_LEFT_DISPLAY_ROUNDS.map((round) => renderPositionedRound(round, leftLayouts, 'left'))}

            <section className="w-60 shrink-0 space-y-5">
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 dark:text-zinc-200">
                  Mundial 2026
                </div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  definición
                </div>
              </div>
              <div className="relative" style={{ height: `${bracketHeightRem}rem` }}>
                {finalMatch && (
                  <div
                    className="pointer-events-none absolute left-[-1.25rem] right-[-1.25rem] z-0 border-t-[3px] border-slate-500 dark:border-zinc-400"
                    style={{
                      top: `${finalTopRem + finalLabelOffsetRem + BRACKET_CARD_HEIGHT_REM / 2}rem`,
                    }}
                  />
                )}
                {finalMatch && (
                  <div className="absolute left-0 right-0 z-20" style={{ top: `${finalTopRem}rem` }}>
                    <div className="mb-2 text-center text-lg font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                      🏆 Final
                    </div>
                    <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-1 dark:border-amber-700 dark:bg-amber-950/20">
                      {renderMatchCard(finalMatch)}
                    </div>
                  </div>
                )}

                {thirdPlaceMatch && (
                  <div className="absolute left-0 right-0 z-20" style={{ top: `${thirdPlaceTopRem}rem` }}>
                    <div className="mb-2 text-center text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">
                      Tercer puesto
                    </div>
                    {renderMatchCard(thirdPlaceMatch)}
                  </div>
                )}
              </div>
            </section>

            {BRACKET_RIGHT_DISPLAY_ROUNDS.map((round) => renderPositionedRound(round, rightLayouts, 'right'))}
          </div>
        </div>
      </div>

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
