import type { ReactNode } from 'react';
import type { ResolvedMatch } from '@/lib/tournament/bracket';
import type { BracketSideRound, BracketLayoutResult, RoundLayout } from '@/lib/tournament/bracketLayout';
import { createConnectorGroups } from '@/lib/tournament/bracketLayout';
import {
  BRACKET_LEFT_DISPLAY_ROUNDS,
  BRACKET_RIGHT_DISPLAY_ROUNDS,
  getRoundLabel,
  type BracketSide,
} from '@/lib/tournament/display';

type BracketCanvasProps = {
  layout: BracketLayoutResult;
  cardWidthClassName?: string;
  centerWidthClassName?: string;
  centerHeaderTitle: string;
  centerHeaderSubtitle?: string;
  finalTitle?: string;
  thirdPlaceTitle?: string;
  ariaLabel: string;
  pendingNotice?: ReactNode;
  topSummary?: ReactNode;
  renderMatchCard: (match: ResolvedMatch) => ReactNode;
};

const renderRoundHeader = (round: BracketSideRound, count: number) => (
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
  round: BracketSideRound,
  layouts: Map<BracketSideRound, RoundLayout>,
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

export default function BracketCanvas({
  layout,
  cardWidthClassName = 'w-56',
  centerWidthClassName = 'w-60',
  centerHeaderTitle,
  centerHeaderSubtitle,
  finalTitle = '🏆 Final',
  thirdPlaceTitle = 'Tercer puesto',
  ariaLabel,
  pendingNotice,
  topSummary,
  renderMatchCard,
}: BracketCanvasProps) {
  const {
    leftLayouts,
    rightLayouts,
    bracketHeightRem,
    finalMatch,
    thirdPlaceMatch,
    finalTopRem,
    thirdPlaceTopRem,
    options,
  } = layout;

  const renderPositionedRound = (
    round: BracketSideRound,
    layouts: Map<BracketSideRound, RoundLayout>,
    side: BracketSide,
  ) => {
    const roundLayout = layouts.get(round);
    const matchesCount = roundLayout?.positionedMatches.length ?? 0;

    return (
      <section key={`${side}-${round}`} className={`${cardWidthClassName} shrink-0 space-y-5`}>
        {renderRoundHeader(round, matchesCount)}
        <div className="relative overflow-visible" style={{ height: `${bracketHeightRem}rem` }}>
          {roundLayout && renderConnectors(round, layouts, side)}
          {roundLayout?.positionedMatches.map((positionedMatch) => (
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

  return (
    <div className="space-y-6">
      {topSummary}
      {pendingNotice}

      <div className="overflow-x-auto overscroll-x-contain pb-4" aria-label={ariaLabel}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex min-w-max items-start gap-8">
            {BRACKET_LEFT_DISPLAY_ROUNDS.map((round) =>
              renderPositionedRound(round, leftLayouts, 'left'),
            )}

            <section className={`${centerWidthClassName} shrink-0 space-y-5`}>
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 dark:text-zinc-200">
                  {centerHeaderTitle}
                </div>
                {centerHeaderSubtitle && (
                  <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    {centerHeaderSubtitle}
                  </div>
                )}
              </div>
              <div className="relative" style={{ height: `${bracketHeightRem}rem` }}>
                {finalMatch && (
                  <div
                    className="pointer-events-none absolute left-[-1.25rem] right-[-1.25rem] z-0 border-t-[3px] border-slate-500 dark:border-zinc-400"
                    style={{
                      top: `${
                        finalTopRem + options.finalLabelOffsetRem + options.cardHeightRem / 2
                      }rem`,
                    }}
                  />
                )}
                {finalMatch && (
                  <div className="absolute left-0 right-0 z-20" style={{ top: `${finalTopRem}rem` }}>
                    <div className="mb-2 text-center text-lg font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                      {finalTitle}
                    </div>
                    <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-1 dark:border-amber-700 dark:bg-amber-950/20">
                      {renderMatchCard(finalMatch)}
                    </div>
                  </div>
                )}

                {thirdPlaceMatch && (
                  <div
                    className="absolute left-0 right-0 z-20"
                    style={{ top: `${thirdPlaceTopRem}rem` }}
                  >
                    <div className="mb-2 text-center text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">
                      {thirdPlaceTitle}
                    </div>
                    {renderMatchCard(thirdPlaceMatch)}
                  </div>
                )}
              </div>
            </section>

            {BRACKET_RIGHT_DISPLAY_ROUNDS.map((round) =>
              renderPositionedRound(round, rightLayouts, 'right'),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
