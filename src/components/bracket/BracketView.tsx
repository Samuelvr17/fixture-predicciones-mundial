import { BracketOutput, ResolvedMatch, Round } from '@/lib/tournament/bracket';
import BracketMatchCard from './BracketMatchCard';

interface BracketViewProps {
  bracket: BracketOutput;
  teams: Map<string, { name: string; code: string }>;
}

const ROUND_ORDER: Round[] = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
  'third_place',
];

const COLUMN_LABELS: Record<string, string> = {
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semifinales',
  final: 'Final',
  third_place: 'Tercer Puesto',
};

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

const MAIN_BRACKET_ROUNDS: Round[] = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
];

const POSITIONED_ROUNDS = new Set<Round>([...MAIN_BRACKET_ROUNDS, 'third_place']);
const CONNECTOR_SOURCE_ROUNDS = new Set<Round>([
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
]);

const BRACKET_CARD_HEIGHT_REM = 17;
const FIRST_ROUND_GAP_REM = 1.25;
const FIRST_ROUND_PITCH_REM = BRACKET_CARD_HEIGHT_REM + FIRST_ROUND_GAP_REM;
const MIN_COLUMN_HEIGHT_REM = BRACKET_CARD_HEIGHT_REM;

const getSlotMatchNumber = (slot?: string) => {
  if (!slot) return undefined;

  const previousMatchSlot = slot.match(/^[WL](\d+)$/);
  if (!previousMatchSlot) return undefined;

  return Number(previousMatchSlot[1]);
};

const getSourceMatchNumbers = (match: ResolvedMatch) =>
  [match.match.team1_slot, match.match.team2_slot]
    .map((slot) => getSlotMatchNumber(slot))
    .filter((matchNumber): matchNumber is number => matchNumber !== undefined);

const getAverage = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;

const createRoundLayouts = (matchesByRound: Map<Round, ResolvedMatch[]>) => {
  const layouts = new Map<Round, RoundLayout>();
  const matchCentersByNumber = new Map<number, number>();

  for (const round of ROUND_ORDER) {
    const roundMatches = matchesByRound.get(round) ?? [];
    const isFirstMainRound = round === MAIN_BRACKET_ROUNDS[0];
    const isPositionedRound = POSITIONED_ROUNDS.has(round);

    const positionedMatches = roundMatches.map((match, index) => {
      const sourceCenters = getSourceMatchNumbers(match)
        .map((matchNumber) => matchCentersByNumber.get(matchNumber))
        .filter((center): center is number => center !== undefined);

      const centerRem =
        isPositionedRound && !isFirstMainRound && sourceCenters.length > 0
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
        (positionedMatch) => positionedMatch.topRem + BRACKET_CARD_HEIGHT_REM
      )
    );

    layouts.set(round, { heightRem, positionedMatches });
  }

  return layouts;
};

const getNextMainBracketRound = (round: Round) => {
  const roundIndex = MAIN_BRACKET_ROUNDS.indexOf(round);

  if (roundIndex === -1 || roundIndex === MAIN_BRACKET_ROUNDS.length - 1) {
    return undefined;
  }

  return MAIN_BRACKET_ROUNDS[roundIndex + 1];
};

const createConnectorGroups = (
  round: Round,
  roundLayouts: Map<Round, RoundLayout>
): ConnectorGroup[] => {
  if (!CONNECTOR_SOURCE_ROUNDS.has(round)) return [];

  const sourceMatches = roundLayouts.get(round)?.positionedMatches ?? [];
  const nextRound = getNextMainBracketRound(round);
  const targetMatches = nextRound
    ? roundLayouts.get(nextRound)?.positionedMatches ?? []
    : [];

  return targetMatches.flatMap((targetMatch, targetIndex) => {
    const firstSource = sourceMatches[targetIndex * 2];
    const secondSource = sourceMatches[targetIndex * 2 + 1];

    if (!firstSource || !secondSource) return [];

    return [
      {
        id: `${round}-${targetMatch.match.match.id}`,
        sourceCentersRem: [firstSource.centerRem, secondSource.centerRem],
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
    return `${resultType === 'W' ? 'Ganador' : 'Perdedor'} del partido ${matchNumber}`;
  }

  const groupPositionSlot = slot.match(/^([12])([A-L])$/);
  if (groupPositionSlot) {
    const [, position, groupCode] = groupPositionSlot;
    return `${position}.º del Grupo ${groupCode}`;
  }

  if (slot.startsWith('3')) {
    const groups = slot.slice(1);
    return groups ? `Mejor 3.º (${groups})` : 'Mejor 3.º';
  }

  return `Origen ${slot}`;
};

export default function BracketView({ bracket, teams }: BracketViewProps) {
  const { matches, champion, thirdPlace } = bracket;

  // Group matches by round
  const matchesByRound = new Map<Round, ResolvedMatch[]>();
  for (const round of ROUND_ORDER) {
    matchesByRound.set(round, []);
  }

  for (const match of matches) {
    const round = match.match.round;
    if (matchesByRound.has(round)) {
      matchesByRound.get(round)!.push(match);
    }
  }

  // Sort matches within each round by match number
  for (const roundMatches of matchesByRound.values()) {
    roundMatches.sort((a, b) => {
      if (a.match.num !== undefined && b.match.num !== undefined) {
        return a.match.num - b.match.num;
      }
      return 0;
    });
  }

  // Get team info
  const getTeamInfo = (teamId?: string) => {
    if (!teamId) return undefined;
    return teams.get(teamId);
  };

  const roundLayouts = createRoundLayouts(matchesByRound);

  const renderMatchCard = (match: ResolvedMatch) => {
    const team1Info = getTeamInfo(match.team1_id);
    const team2Info = getTeamInfo(match.team2_id);
    const team1SourceLabel = getSlotSourceLabel(match.team1_slot ?? match.match.team1_slot);
    const team2SourceLabel = getSlotSourceLabel(match.team2_slot ?? match.match.team2_slot);

    return (
      <BracketMatchCard
        match={match}
        team1Name={team1Info?.name}
        team2Name={team2Info?.name}
        team1Code={team1Info?.code}
        team2Code={team2Info?.code}
        team1SourceLabel={team1SourceLabel}
        team2SourceLabel={team2SourceLabel}
      />
    );
  };

  const renderRoundMatches = (round: Round) => (
    <div className="space-y-3">
      {matchesByRound.get(round)?.map((match) => (
        <div key={match.match.id}>{renderMatchCard(match)}</div>
      ))}
    </div>
  );

  const renderConnectors = (round: Round) =>
    createConnectorGroups(round, roundLayouts).map((connector) => {
      const [firstSourceCenterRem, secondSourceCenterRem] = connector.sourceCentersRem;
      const topCenterRem = Math.min(firstSourceCenterRem, secondSourceCenterRem);
      const bottomCenterRem = Math.max(firstSourceCenterRem, secondSourceCenterRem);
      const verticalHeightRem = bottomCenterRem - topCenterRem;

      return (
        <div key={connector.id} className="pointer-events-none absolute inset-0 hidden md:block">
          {connector.sourceCentersRem.map((sourceCenterRem) => (
            <div
              key={`${connector.id}-${sourceCenterRem}`}
              className="absolute left-full w-2.5 border-t border-zinc-300 dark:border-zinc-700 lg:w-3"
              style={{ top: `${sourceCenterRem}rem` }}
            />
          ))}
          <div
            className="absolute left-[calc(100%+0.625rem)] border-r border-zinc-300 dark:border-zinc-700 lg:left-[calc(100%+0.75rem)]"
            style={{
              top: `${topCenterRem}rem`,
              height: `${verticalHeightRem}rem`,
            }}
          />
          <div
            className="absolute left-[calc(100%+0.625rem)] w-2.5 border-t border-zinc-300 dark:border-zinc-700 lg:left-[calc(100%+0.75rem)] lg:w-3"
            style={{ top: `${connector.targetCenterRem}rem` }}
          />
        </div>
      );
    });

  const renderPositionedRoundMatches = (round: Round) => {
    const layout = roundLayouts.get(round);

    if (!layout) return null;

    return (
      <div
        className="relative min-w-[280px] overflow-visible"
        style={{ height: `${layout.heightRem}rem` }}
      >
        {renderConnectors(round)}
        {layout.positionedMatches.map((positionedMatch) => (
          <div
            key={positionedMatch.match.match.id}
            className="absolute left-0 right-0 z-10"
            style={{
              top: `${positionedMatch.topRem}rem`,
              minHeight: `${BRACKET_CARD_HEIGHT_REM}rem`,
            }}
          >
            {renderMatchCard(positionedMatch.match)}
          </div>
        ))}
      </div>
    );
  };

  const renderRoundHeader = (round: Round) => (
    <div className="sticky top-0 z-10 -mx-1 border-b border-zinc-200/80 bg-zinc-50/95 px-1 py-3 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/95 md:static md:z-auto md:mx-0 md:rounded-xl md:border md:bg-white md:px-4 md:py-3 md:shadow-sm md:backdrop-blur-none md:dark:bg-zinc-900">
      <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50 md:text-lg">
        {COLUMN_LABELS[round]}
      </h2>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {matchesByRound.get(round)?.length || 0} partidos
      </p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Champion and third place highlights */}
      {(champion || thirdPlace) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
          {champion && (
            <div className="overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 p-1 shadow-lg shadow-amber-500/20 dark:border-amber-600/70">
              <div className="rounded-[0.875rem] bg-white/15 p-5 text-white backdrop-blur sm:p-6 lg:p-7">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-50/90">
                  Campeón
                </div>
                <div className="mt-3 text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
                  {getTeamInfo(champion)?.name || 'TBD'}
                </div>
                <div className="mt-4 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-white/30">
                  Levanta la copa
                </div>
              </div>
            </div>
          )}

          {thirdPlace && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm dark:border-sky-800/80 dark:bg-sky-950/40 sm:p-6 lg:p-7">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
                Tercer Puesto
              </div>
              <div className="mt-3 text-2xl font-black leading-tight text-sky-950 dark:text-sky-50 sm:text-3xl">
                {getTeamInfo(thirdPlace)?.name || 'TBD'}
              </div>
              <div className="mt-4 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-800 ring-1 ring-sky-200 dark:bg-sky-900/60 dark:text-sky-200 dark:ring-sky-700/70">
                Podio confirmado
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile round sections */}
      <div
        className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-4 md:hidden"
        aria-label="Rondas eliminatorias con desplazamiento horizontal"
      >
        <div className="flex w-max min-w-full gap-4">
          {ROUND_ORDER.map((round) => (
            <section
              key={round}
              className="w-[280px] shrink-0 space-y-3"
              aria-labelledby={`mobile-${round}`}
            >
              <div id={`mobile-${round}`}>{renderRoundHeader(round)}</div>
              {renderRoundMatches(round)}
            </section>
          ))}
        </div>
      </div>

      {/* Tablet and desktop bracket columns */}
      <div className="hidden md:block">
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-5 lg:gap-6">
            {ROUND_ORDER.map((round) => (
              <section key={round} className="relative min-w-[280px] max-w-[320px] flex-1 space-y-4">
                {renderRoundHeader(round)}
                {renderPositionedRoundMatches(round)}
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Pending slots warning */}
      {bracket.pendingSlots.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-2 h-2 bg-amber-500 rounded-full mt-2" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                Slots Pendientes
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Hay {bracket.pendingSlots.length} slots que aún no pueden resolverse. 
                Esto puede deberse a resultados faltantes o desempates por definir.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
