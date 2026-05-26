import { ResolvedMatch, PendingSlot } from '@/lib/tournament/bracket';

interface BracketMatchCardProps {
  match: ResolvedMatch;
  team1Name?: string;
  team2Name?: string;
  team1Code?: string;
  team2Code?: string;
}

const ROUND_LABELS: Record<string, string> = {
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semifinales',
  third_place: 'Tercer Puesto',
  final: 'Final',
};

const PENDING_REASON_LABELS: Record<string, string> = {
  missing_standings: 'Faltan posiciones de grupo',
  missing_best_thirds: 'Faltan mejores terceros',
  missing_third_place_assignment: 'Asignación de terceros pendiente',
  missing_match_result: 'Falta resultado del partido',
  invalid_slot: 'Slot inválido',
};

export default function BracketMatchCard({
  match,
  team1Name,
  team2Name,
  team1Code,
  team2Code,
}: BracketMatchCardProps) {
  const { match: m, team1_id, team2_id, team1_slot, team2_slot, winner_team_id, pendingSlots } = match;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  const getPendingReason = () => {
    if (pendingSlots.length === 0) return null;
    // Return the first pending slot's reason
    return PENDING_REASON_LABELS[pendingSlots[0].reason] || pendingSlots[0].reason;
  };

  const isTeam1Pending = !team1_id && team1_slot;
  const isTeam2Pending = !team2_id && team2_slot;
  const pendingReason = getPendingReason();

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-sm">
      {/* Match number and round */}
      <div className="flex justify-between items-center mb-3">
        {m.num && (
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            #{m.num}
          </span>
        )}
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          {ROUND_LABELS[m.round] || m.round}
        </span>
      </div>

      {/* Date and venue */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
        <div>{formatDate(m.date)} - {formatTime(m.time)}</div>
        <div className="truncate">{m.ground}</div>
      </div>

      {/* Teams */}
      <div className="space-y-2">
        {/* Team 1 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {team1Code && (
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {team1Code}
              </span>
            )}
            <span className={`text-sm ${isTeam1Pending ? 'text-zinc-400 italic' : 'text-zinc-900 dark:text-zinc-100'}`}>
              {team1Name || team1_slot || 'TBD'}
            </span>
          </div>
          {/* Score would go here if we had results */}
        </div>

        {/* Team 2 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {team2Code && (
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {team2Code}
              </span>
            )}
            <span className={`text-sm ${isTeam2Pending ? 'text-zinc-400 italic' : 'text-zinc-900 dark:text-zinc-100'}`}>
              {team2Name || team2_slot || 'TBD'}
            </span>
          </div>
          {/* Score would go here if we had results */}
        </div>
      </div>

      {/* Pending status */}
      {pendingReason && (
        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {pendingReason}
            </span>
          </div>
        </div>
      )}

      {/* Winner indicator */}
      {winner_team_id && (
        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Avanza: {winner_team_id === team1_id ? team1Name : team2Name}
          </span>
        </div>
      )}
    </div>
  );
}
