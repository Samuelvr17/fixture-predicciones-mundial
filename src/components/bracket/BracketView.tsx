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
  for (const [round, roundMatches] of matchesByRound) {
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

  const renderRoundMatches = (round: Round) => (
    <div className="space-y-3">
      {matchesByRound.get(round)?.map((match) => {
        const team1Info = getTeamInfo(match.team1_id);
        const team2Info = getTeamInfo(match.team2_id);
        return (
          <BracketMatchCard
            key={match.match.id}
            match={match}
            team1Name={team1Info?.name}
            team2Name={team2Info?.name}
            team1Code={team1Info?.code}
            team2Code={team2Info?.code}
          />
        );
      })}
    </div>
  );

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
      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:hidden">
        <div className="flex min-w-max gap-4">
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
              <section key={round} className="min-w-[280px] max-w-[320px] flex-1 space-y-4">
                {renderRoundHeader(round)}
                {renderRoundMatches(round)}
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
