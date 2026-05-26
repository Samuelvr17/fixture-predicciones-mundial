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
  'third_place',
  'final',
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

  return (
    <div className="space-y-8">
      {/* Champion banner */}
      {champion && (
        <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-lg p-6 shadow-lg">
          <div className="text-center">
            <div className="text-sm font-medium uppercase tracking-wide mb-1">Campeón</div>
            <div className="text-3xl font-bold">
              {getTeamInfo(champion)?.name || 'TBD'}
            </div>
          </div>
        </div>
      )}

      {/* Bracket columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Round of 32 */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-2">
            {COLUMN_LABELS.round_of_32}
          </h2>
          <div className="space-y-3">
            {matchesByRound.get('round_of_32')?.map((match) => {
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
        </div>

        {/* Round of 16 */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-2">
            {COLUMN_LABELS.round_of_16}
          </h2>
          <div className="space-y-3">
            {matchesByRound.get('round_of_16')?.map((match) => {
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
        </div>

        {/* Quarter Finals */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-2">
            {COLUMN_LABELS.quarter_final}
          </h2>
          <div className="space-y-3">
            {matchesByRound.get('quarter_final')?.map((match) => {
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
        </div>

        {/* Semi Finals */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-2">
            {COLUMN_LABELS.semi_final}
          </h2>
          <div className="space-y-3">
            {matchesByRound.get('semi_final')?.map((match) => {
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
        </div>

        {/* Final and Third Place */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-2">
            Final
          </h2>
          <div className="space-y-3">
            {matchesByRound.get('final')?.map((match) => {
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

          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-2 mt-8">
            {COLUMN_LABELS.third_place}
          </h2>
          <div className="space-y-3">
            {matchesByRound.get('third_place')?.map((match) => {
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

          {/* Third place winner */}
          {thirdPlace && (
            <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg p-4">
              <div className="text-center">
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Tercer Puesto</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {getTeamInfo(thirdPlace)?.name || 'TBD'}
                </div>
              </div>
            </div>
          )}
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
