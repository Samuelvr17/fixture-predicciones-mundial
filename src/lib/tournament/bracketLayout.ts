import type { ResolvedMatch, Round } from './bracket';
import {
  BRACKET_ROUND_ORDER,
  BRACKET_SIDE_MATCH_NUMBERS,
  BRACKET_SIDE_ROUNDS,
  type BracketSide,
} from './display';
import { getSlotMatchNumber } from './slotLabels';

export type BracketSideRound = (typeof BRACKET_SIDE_ROUNDS)[number];

export type PositionedMatch = {
  match: ResolvedMatch;
  topRem: number;
  centerRem: number;
};

export type RoundLayout = {
  heightRem: number;
  positionedMatches: PositionedMatch[];
};

export type ConnectorGroup = {
  id: string;
  sourceCentersRem: [number, number];
  targetCenterRem: number;
};

export type BracketLayoutOptions = {
  cardHeightRem: number;
  firstRoundGapRem: number;
  minBracketHeightRem: number;
  finalLabelOffsetRem?: number;
  thirdPlaceGapRem?: number;
};

export type BracketLayoutResult = {
  matchesByRound: Map<Round, ResolvedMatch[]>;
  leftLayouts: Map<BracketSideRound, RoundLayout>;
  rightLayouts: Map<BracketSideRound, RoundLayout>;
  bracketHeightRem: number;
  finalMatch?: ResolvedMatch;
  thirdPlaceMatch?: ResolvedMatch;
  finalTopRem: number;
  thirdPlaceTopRem: number;
  options: Required<BracketLayoutOptions>;
};

const DEFAULT_FINAL_LABEL_OFFSET_REM = 1.75;
const DEFAULT_THIRD_PLACE_GAP_REM = 2.3;

const getAverage = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;

const compareMatchesByNumber = (a: ResolvedMatch, b: ResolvedMatch) => {
  if (a.match.num !== undefined && b.match.num !== undefined) {
    return a.match.num - b.match.num;
  }

  return 0;
};

const normalizeOptions = (options: BracketLayoutOptions): Required<BracketLayoutOptions> => ({
  ...options,
  finalLabelOffsetRem: options.finalLabelOffsetRem ?? DEFAULT_FINAL_LABEL_OFFSET_REM,
  thirdPlaceGapRem: options.thirdPlaceGapRem ?? DEFAULT_THIRD_PLACE_GAP_REM,
});

export const isBracketSideRound = (round: Round): round is BracketSideRound =>
  BRACKET_SIDE_ROUNDS.some((sideRound) => sideRound === round);

export const getSourceMatchNumbers = (match: ResolvedMatch): number[] =>
  [match.match.team1_slot, match.match.team2_slot]
    .map((slot) => getSlotMatchNumber(slot))
    .filter((matchNumber): matchNumber is number => matchNumber !== undefined);

export const getNextSideRound = (round: Round): BracketSideRound | undefined => {
  if (!isBracketSideRound(round)) {
    return undefined;
  }

  const roundIndex = BRACKET_SIDE_ROUNDS.indexOf(round);
  return BRACKET_SIDE_ROUNDS[roundIndex + 1];
};

export const createRoundLayouts = (
  matchesByRound: Map<Round, ResolvedMatch[]>,
  options: BracketLayoutOptions,
): Map<BracketSideRound, RoundLayout> => {
  const { cardHeightRem, firstRoundGapRem } = normalizeOptions(options);
  const firstRoundPitchRem = cardHeightRem + firstRoundGapRem;
  const layouts = new Map<BracketSideRound, RoundLayout>();
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
          : index * firstRoundPitchRem + cardHeightRem / 2;
      const topRem = Math.max(0, centerRem - cardHeightRem / 2);

      return { match, topRem, centerRem };
    });

    for (const positionedMatch of positionedMatches) {
      const matchNumber = positionedMatch.match.match.num;
      if (matchNumber !== undefined) {
        matchCentersByNumber.set(matchNumber, positionedMatch.centerRem);
      }
    }

    const heightRem = Math.max(
      cardHeightRem,
      ...positionedMatches.map((positionedMatch) => positionedMatch.topRem + cardHeightRem),
    );

    layouts.set(round, { heightRem, positionedMatches });
  }

  return layouts;
};

export const createConnectorGroups = (
  round: Round,
  roundLayouts: Map<BracketSideRound, RoundLayout>,
): ConnectorGroup[] => {
  if (!isBracketSideRound(round)) {
    return [];
  }

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

export const buildBracketLayout = (
  matches: ResolvedMatch[],
  options: BracketLayoutOptions,
): BracketLayoutResult => {
  const normalizedOptions = normalizeOptions(options);
  const matchesByRound = new Map<Round, ResolvedMatch[]>();

  for (const round of BRACKET_ROUND_ORDER) {
    matchesByRound.set(round, []);
  }

  for (const match of matches) {
    const round = match.match.round;
    if (matchesByRound.has(round)) {
      matchesByRound.get(round)?.push(match);
    }
  }

  for (const roundMatches of matchesByRound.values()) {
    roundMatches.sort(compareMatchesByNumber);
  }

  const getSideMatchesByRound = (side: BracketSide) => {
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

  const leftLayouts = createRoundLayouts(getSideMatchesByRound('left'), normalizedOptions);
  const rightLayouts = createRoundLayouts(getSideMatchesByRound('right'), normalizedOptions);
  const bracketHeightRem = Math.max(
    ...BRACKET_SIDE_ROUNDS.flatMap((round) => [
      leftLayouts.get(round)?.heightRem ?? 0,
      rightLayouts.get(round)?.heightRem ?? 0,
    ]),
    normalizedOptions.minBracketHeightRem,
  );

  const finalMatch = matchesByRound.get('final')?.[0];
  const thirdPlaceMatch = matchesByRound.get('third_place')?.[0];
  const finalTopRem = Math.max(
    0,
    bracketHeightRem / 2 -
      normalizedOptions.finalLabelOffsetRem -
      normalizedOptions.cardHeightRem / 2,
  );
  const thirdPlaceTopRem =
    finalTopRem +
    normalizedOptions.finalLabelOffsetRem +
    normalizedOptions.cardHeightRem +
    normalizedOptions.thirdPlaceGapRem;

  return {
    matchesByRound,
    leftLayouts,
    rightLayouts,
    bracketHeightRem,
    finalMatch,
    thirdPlaceMatch,
    finalTopRem,
    thirdPlaceTopRem,
    options: normalizedOptions,
  };
};
